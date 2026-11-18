import { loadSignal } from '@merlin/plugin-api';
import { localize } from './translate';
import { dictionary } from './dictionary';
import manifest from '../manifest.json';

if (!loadSignal.aborted) {
  const stop = localize(document, dictionary);
  loadSignal.addEventListener('abort', stop, { once: true });
  console.info(`[unreal-canvas-zh-cn] 简体中文已加载（${manifest.version}）`);
}
