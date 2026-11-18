import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const url = new URL(process.argv[2] ?? 'http://localhost:4332');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  await page.goto(url.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  console.log('tabControls',await page.locator('.merlin-canvas-tab button').evaluateAll(es=>es.map(e=>({tag:e.tagName,classes:e.className,parentClasses:e.parentElement.className,hasAria:e.hasAttribute('aria-label'),hasTitle:e.hasAttribute('title')}))));
  await page.locator('.merlin-app-bar button[aria-label="设置"]').click();
  console.log('search',await page.locator('.settings-window-body input[placeholder]').evaluateAll(es=>es.map(e=>({placeholder:e.getAttribute('placeholder'),codepoints:[...e.getAttribute('placeholder')].map(c=>c.codePointAt(0))}))));
  await page.locator('.settings-nav button').filter({hasText:/^模型服务商$/}).click();
  for(const text of ['accepts image, video, audio','accepts image, image2, image3, image4, source, video']) {
    console.log('capability',JSON.stringify(await page.getByText(text,{exact:true}).evaluateAll(es=>es.map(e=>({html:e.outerHTML,parentClass:e.parentElement.className,nodes:[...e.childNodes].map(n=>({type:n.nodeType,value:n.nodeValue}))})))));
  }
} finally {await browser.close();}
