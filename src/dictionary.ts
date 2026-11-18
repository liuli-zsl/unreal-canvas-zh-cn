import base from './locales/zh-CN.json';
import generation from './locales/generation-extra.json';
import editors from './locales/editors-extra.json';
import scriptAuthoring from './locales/script-authoring-extra.json';
import menus from './locales/menus-extra.json';
import panels from './locales/panels-extra.json';
import settings from './locales/settings-extra.json';
import viewers from './locales/viewers-extra.json';

export const dictionary = [...generation, ...editors, ...scriptAuthoring, ...viewers, ...menus, ...panels, ...settings, ...base];
