import { loadSignal } from '@merlin/plugin-api';
import { localize } from './translate';
import dictionary from './locales/zh-CN.json';

if (!loadSignal.aborted) {
  const stop = localize(document, dictionary);
  loadSignal.addEventListener('abort', stop, { once: true });
  console.info('[unreal-canvas-zh-cn] 简体中文已加载');
}
