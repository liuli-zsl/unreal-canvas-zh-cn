import base from './locales/zh-CN.json';
import generation from './locales/generation-extra.json';
import editors from './locales/editors-extra.json';
import scriptAuthoring from './locales/script-authoring-extra.json';
import menus from './locales/menus-extra.json';
import panels from './locales/panels-extra.json';
import settings from './locales/settings-extra.json';
import viewers from './locales/viewers-extra.json';
import canvasActions from './locales/canvas-actions-022.json';
import shelfActions from './locales/shelf-actions.json';
import panelActions from './locales/panel-actions-022.json';
import settingsActions from './locales/settings-actions-022.json';

export const dictionary = [...canvasActions, ...panelActions, ...settingsActions, ...shelfActions, ...generation, ...editors, ...scriptAuthoring, ...viewers, ...menus, ...panels, ...settings, ...base];
