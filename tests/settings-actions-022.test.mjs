import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const compiled = await build({
  stdin: { contents: "export {localize} from './src/translate'; export {dictionary} from './src/dictionary';", resolveDir: process.cwd() },
  write: false, bundle: true, format: 'esm', platform: 'node',
});
const { localize, dictionary } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64'));

test('provider setup preserves variable names, parser diagnostics, drafts and restores original labels', () => {
  const dom = new JSDOM(`<div class="settings-window-body"><main>
    <section class="provider-onboarding"><h2>Connect Save</h2><p>Save accepted the connection check.</p>
    <input aria-label="API key" placeholder="Paste your API key" value="Save"></section>
    <section><div role="dialog"><div><h3>Add media schema</h3></div>
    <div><div style="color: var(--color-danger-muted)">Invalid JSON in file: Unexpected token 'Save'</div></div></div></section>
    <pre>Connect Save</pre><div class="merlin-chat-md"><p>What to tell the agent</p></div>
    </main></div>`);
  try {
    const doc = dom.window.document;
    const texts = selector => doc.querySelector(selector).textContent;
    const stop = localize(doc, dictionary);
    assert.equal(texts('h2'), '连接 Save');
    assert.equal(texts('section p'), 'Save 已通过连接检查。');
    assert.equal(texts('[style]'), "文件中的 JSON 格式无效：Unexpected token 'Save'");
    assert.equal(texts('pre'), 'Connect Save');
    assert.equal(texts('.merlin-chat-md p'), 'What to tell the agent');
    assert.equal(doc.querySelector('input').value, 'Save');
    stop();
    assert.equal(texts('h2'), 'Connect Save');
    assert.equal(texts('section p'), 'Save accepted the connection check.');
    assert.equal(texts('[style]'), "Invalid JSON in file: Unexpected token 'Save'");
    assert.equal(doc.querySelector('input').getAttribute('placeholder'), 'Paste your API key');
  } finally {
    dom.window.close();
  }
});
