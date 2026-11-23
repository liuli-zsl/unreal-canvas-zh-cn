// Render Canvas's installed viewer components with temporary, in-memory media.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const host = new URL(process.argv[2] || 'http://localhost:10678');
assert.ok(['127.0.0.1', 'localhost'].includes(host.hostname), 'Use a local Canvas server');
const candidate = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({viewport: {width: 1100, height: 800}});
page.setDefaultTimeout(8000);
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
const loopbackURL = resource => new URL(resource, host).href;
async function source(resource) {
  const response = await page.request.get(loopbackURL(resource));
  assert.equal(response.status(), 200, resource);
  return response.text();
}
function asset(sourceText, prefix) {
  const match = sourceText.match(new RegExp(prefix + '-[\\w-]+\\.js'));
  assert.ok(match, 'Missing Canvas component ' + prefix);
  return '/assets/' + match[0];
}
const html = '<!doctype html><meta charset="utf-8"><div id="root" style="width:850px;height:480px"></div>' +
  '<script type="importmap">{"imports":{"@merlin/plugin-api":"/__viewer-api.js"}}</script>';
try {
  const bundle = candidate ? await readFile(candidate, 'utf8') : await source('/api/plugins/frontend/unreal-canvas-zh-cn/index.js');
  const clip = await readFile(new URL('../tests/fixtures/viewer.webm', import.meta.url));
  const mesh = await readFile(new URL('../tests/fixtures/viewer.glb', import.meta.url));
  // One Gaussian with 3 position floats, 3 scale floats, RGBA and a byte quaternion.
  const splat = Buffer.alloc(32);
  for (const offset of [12,16,20]) splat.writeFloatLE(0.3,offset);
  splat.set([255,60,0,255,255,128,128,128],24);
  const environment = Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 2\n'),
    Buffer.from(Array.from({length:4},()=>[128,128,128,129]).flat())]);
  let splatFetched = false;
  const index = await source('/');
  const entry = await source(asset(await source(asset(index, 'index')), 'appEntry'));
  const groups = await source(asset(entry, 'runGroups'));
  const components = Object.fromEntries(['PanoramaViewer','MeshViewer','SplatViewer','UsdViewer','VideoPlayer']
    .map(name => [name, asset(groups, name)]));
  const react = asset(entry, 'vendor-reactflow');
  const renderer = asset(entry, 'importFiles');
  const binding = entry.match(/(\w+)\.createRoot\(document\.getElementById\("root"\)\)/)?.[1];
  assert.ok(binding, 'Cannot identify the installed React renderer');
  const rendererExport = entry.match(new RegExp('(\\w+) as ' + binding + '[,}]'))?.[1];
  assert.ok(rendererExport);

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
    // MeshViewer requests a studio environment. Fulfill it here so the test stays offline.
    if (url.pathname.endsWith('/studio_small_03_1k.hdr')) return route.fulfill({contentType:'application/octet-stream',body:environment});
    if (url.origin !== host.origin) return route.abort();
    const path = url.pathname;
    if (path === '/__viewer-mesh.glb') return route.fulfill({contentType:'model/gltf-binary',body:mesh});
    if (path === '/__viewer-cloud.splat') {
      splatFetched = true;
      return route.fulfill({contentType:'application/octet-stream',body:splat});
    }
    if (path === '/__viewer-test.webm') return route.fulfill({contentType:'video/webm',body:clip});
    if (path === '/__viewer-fixture') return route.fulfill({contentType:'text/html', body:html});
    if (path === '/__viewer-api.js') return route.fulfill({contentType:'text/javascript', body:'export const loadSignal = new AbortController().signal;'});
    if (path === '/__viewer-plugin.js') return route.fulfill({contentType:'text/javascript', body:bundle});
    if (path === '/api/usd/hierarchy') {
      const prim = {name:'Save',path:'/Save',type:'Xform',hasChildren:false};
      return route.fulfill({json:{prims:[prim],childCount:1,nextOffset:null}});
    }
    if (path.startsWith('/api/') || path.startsWith('/__missing')) {
      return route.fulfill({status:404,body:'Missing fixture asset'});
    }
    if (!path.startsWith('/assets/')) return route.abort();
    return route.continue();
  });
  await page.goto(loopbackURL('/__viewer-fixture'));
  await page.evaluate(async ({react,renderer,rendererExport,components}) => {
    await import('/__viewer-plugin.js');
    const R = (await import(react)).r;
    const root = (await import(renderer))[rendererExport].createRoot(document.getElementById('root'));
    let version = 0;
    window.mountViewer = async (name, props) => {
      const Component = (await import(components[name]))[name];
      root.render(R.createElement(Component, {...props,key:++version}));
    };
  }, {react,renderer,rendererExport,components});
  const mount = (name,props) => page.evaluate(([name,props]) => window.mountViewer(name,props), [name,props]);

  await mount('MeshViewer',{url:'/__missing.unsupported',height:350});
  await page.getByText('无法显示此网格', {exact:true}).waitFor();
  await page.getByText(/目前无法预览 \.unsupported 文件。/).waitFor();
  await mount('MeshViewer',{url:'/__viewer-mesh.glb',height:350});
  await page.getByRole('button',{name:'骨骼',exact:true}).waitFor();
  const bones = page.getByRole('button',{name:'骨骼',exact:true});
  assert.equal(await bones.getAttribute('title'),'隐藏骨架');
  await page.getByRole('slider',{name:'骨架后方网格的不透明度'}).waitFor();
  await bones.click();
  assert.equal(await bones.getAttribute('title'),'显示骨架');
  checks.push('有效的单骨骼网格、骨架开关、透明度和未知格式提示');

  await mount('PanoramaViewer',{url:'/__missing.png',height:350});
  await page.getByText('无法加载全景图', {exact:true}).waitFor();
  const panorama = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width=64; c.height=32;
    const g=c.getContext('2d'); const paint=g.createLinearGradient(0,0,64,0);
    paint.addColorStop(0,'navy'); paint.addColorStop(1,'gold'); g.fillStyle=paint; g.fillRect(0,0,64,32);
    return c.toDataURL();
  });
  await mount('PanoramaViewer',{url:panorama,height:350});
  await page.locator('#root canvas').waitFor();
  await page.waitForFunction(() => !/正在加载全景图|无法加载全景图/.test(document.getElementById('root').innerText));
  for (const name of ['放大','缩小','重置视图']) await page.getByRole('button',{name,exact:true}).click();
  checks.push('全景图加载、放大、缩小和重置');

  await mount('SplatViewer',{url:'/__missing.unsupported',height:350});
  await page.getByText('高斯泼溅场景加载失败。',{exact:true}).waitFor();
  assert.equal(await page.locator('.info-panel-row .label-cell').filter({hasText:'摄像机位置：'}).count(),1);
  assert.match(await page.locator('[class*="messageContainerPrimary"]').first().textContent(),/正在下载：\d+%/);
  const cloud = page.waitForResponse(r => new URL(r.url()).pathname === '/__viewer-cloud.splat' && r.ok());
  await mount('SplatViewer',{url:'/__viewer-cloud.splat',height:350});
  await cloud;
  await page.locator('#root canvas').waitFor();
  await page.waitForFunction(() => !document.getElementById('root').innerText.trim());
  assert.ok(splatFetched);
  checks.push('本地单点高斯场景、失败提示、信息面板和下载百分比');

  await mount('UsdViewer',{path:'/__missing.usda'});
  await page.getByRole('button',{name:'重试预览'}).waitFor();
  await page.getByRole('button',{name:'显示场景'}).click();
  // The hierarchy is served exclusively by this fixture. Its authored name must remain unchanged.
  await page.getByRole('button',{name:/Save Xform/}).waitFor();
  await page.getByRole('button',{name:'隐藏场景'}).waitFor();
  await page.getByRole('combobox',{name:'USD 摄像机'}).click();
  await page.getByRole('option',{name:'检查摄像机'}).waitFor();
  await page.keyboard.press('Escape');
  checks.push('USD 场景树、摄像机列表、重试和用户命名的 prim');

  await mount('VideoPlayer',{src:'/__viewer-test.webm'});
  const videoElement = page.locator('video');
  await videoElement.waitFor();
  await videoElement.evaluate(v => { v.preload = 'auto'; v.load(); });
  await page.waitForFunction(()=>document.querySelector('video')?.readyState >= 2).catch(async error => {
    throw new Error(error.message + ' ' + JSON.stringify(await videoElement.evaluate(v =>
      ({ready:v.readyState, network:v.networkState, error:v.error?.message, source:v.currentSrc}))));
  });
  await page.getByRole('button',{name:'取消静音',exact:true}).click();
  await page.getByRole('button',{name:'静音',exact:true}).waitFor();
  await page.getByRole('button',{name:'循环播放',exact:true}).click();
  await page.getByRole('button',{name:'播放',exact:true}).click();
  await page.getByRole('button',{name:'暂停',exact:true}).waitFor();
  await page.getByRole('button',{name:'停止',exact:true}).click();
  await page.getByRole('button',{name:'下一帧',exact:true}).click();
  await page.getByRole('button',{name:'上一帧',exact:true}).click();
  checks.push('本地生成的视频可播放、停止、循环、切换静音和逐帧浏览');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({host:host.origin,checks},null,2));
} finally {
  await browser.close();
}