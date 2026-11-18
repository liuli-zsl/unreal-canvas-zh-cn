const types = new Map(Object.entries({
  Text:'文本',Float:'浮点数',Integer:'整数',Boolean:'布尔值',Choice:'选项',
  'Vector 2':'二维向量','Vector 3':'三维向量',Image:'图像',Video:'视频',Mesh:'网格',
  Audio:'音频',Splat:'高斯泼溅',File:'文件',Other:'其他',Graph:'节点图',
  text:'文本',float:'浮点数',int:'整数',boolean:'布尔值',image:'图像',video:'视频',
  mesh:'网格',splat:'高斯泼溅',audio:'音频',file:'文件',sceneJson:'场景 JSON',
  objectRef:'对象引用',any:'任意类型',usd:'USD',USD:'USD',
}));

const subtypes = new Map(Object.entries({
  source:['Source','源'],annotation:['Annotation','标注'],beauty:['Beauty','最终合成'],
  depth:['Depth','深度'],normal:['Normal','法线'],mask:['Mask','遮罩'],edge:['Edge','边缘'],
  pose:['Pose','姿势'],cutout:['Cutout','抠像'],plate:['Clean plate','干净背景'],
  panorama:['Panorama','全景图'],splat:['Splat','高斯泼溅'],
  view_front:['Front view','前视图'],view_back:['Back view','后视图'],
  view_left:['Left view','左视图'],view_right:['Right view','右视图'],
  music:['Music','音乐'],ambience:['Ambience','环境声'],speech:['Speech','语音'],
}));
const locations = new Map(Object.entries({'Team library':'团队资源库','My scripts':'我的脚本','Built-in':'内置'}));
const builtInGroups: Record<string, string | undefined> = {Default:'默认', Advanced:'高级', 'Default inputs':'默认输入','Advanced inputs':'高级输入'};
const requirements = new Map(Object.entries({
  'Optional':'可选','Required':'必填',
  'Required — click to make optional':'必填，点击改为可选',
  'Optional — click to make required':'可选，点击改为必填',
  'Required by the model this input feeds':'使用此输入的模型要求必填',
}));

const filterDialog = '[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"])';
const filterFields = new Map(Object.entries({
  name:['Name','名称'],notes:['Notes','备注'],status:['Status','状态'],team:['Team','团队'],
  person:['Person','人员'],tags:['Tags','标签'],votes:['Votes','投票'],rating:['Rating','评分'],
  kind:['Kind','种类'],outputType:['Type','类型'],id:['ID','ID'],
  'sys:prompt':['Prompt','提示词'],'sys:negativePrompt':['Negative','负面提示词'],
  'sys:duration':['Run time','运行耗时'],'sys:mediaDuration':['Duration','媒体时长'],
  'sys:sequence':['Sequence','序列'],'sys:resolution':['Resolution','分辨率'],
  'sys:model':['Model','模型'],'sys:seed':['Seed','随机种子'],'sys:cardType':['Card type','卡片类型'],
  'sys:source':['Source','来源'],'sys:description':['Description','描述'],'sys:kindLabel':['Kind name','种类名称'],
  'sys:runStatus':['Run','运行状态'],'sys:sourceFile':['File','文件'],'sys:childCount':['Contents','内容'],
  'sys:c2pa':['Provenance','来源凭证'],
}));

function fieldOption(element: Element, english: string): string | null | undefined {
  const option = element.parentElement?.closest('[role="option"][data-value]');
  const list = option?.closest('[role="listbox"][id]');
  const control = list
    ? Array.from(element.ownerDocument.querySelectorAll(filterDialog + ' button[aria-controls]')).find(button => button.getAttribute('aria-controls') === list.id)
    : element.closest('button.custom-select');
  if (!control?.closest(filterDialog) || control.closest('[role="group"]') || control.getAttribute('data-value') !== '') return undefined;
  if (!option) {
    // The trigger also holds sizing copies of every label, including authored custom fields.
    if (element.getAttribute('aria-hidden') === 'false' && english === '+ Add field…') return '＋ 添加字段…';
    return undefined;
  }
  const id = option.getAttribute('data-value') ?? '';
  if (!id && english === '+ Add field…') return '＋ 添加字段…';
  const pair = filterFields.get(id);
  return pair && english === pair[0] ? pair[1] : null;
}

function dataType(label: string) {
  if (label.endsWith('[]')) {
    const single = types.get(label.slice(0,-2));
    if (single) return single + '数组';
  }
  return types.get(label);
}

function scriptOption(element: Element, english: string): string | null | undefined {
  let control = element.closest('button.custom-select');
  const option = element.closest('[role="option"][data-value]');
  if (!control && option) {
    const list = option.closest('[role="listbox"][id]');
    if (list) control = Array.from(element.ownerDocument.querySelectorAll('.merlin-script-form-row button[aria-controls]'))
      .find(button => button.getAttribute('aria-controls') === list.id) ?? null;
  }
  if (!control?.closest('.merlin-script-form-row')) return undefined;
  if (control.closest('.merlin-graph-inspector-subtype')) {
    const id = option?.getAttribute('data-value') ?? control.getAttribute('data-value');
    // Custom subtypes use x: IDs. A user can give one the same label as a built-in.
    if (id?.startsWith('x:') && (option || element.getAttribute('aria-hidden') === 'false')) return null;
    const pair = id && subtypes.get(id);
    return pair && english === pair[0] ? pair[1] : undefined;
  }
  if (control.parentElement?.parentElement?.classList.contains('merlin-script-form-row')) return dataType(english);
  return undefined;
}

export function translatePanelActions(element: Element, field: string, english: string): string | null | undefined {
  const selectLabel = element.localName === 'span' && element.parentElement?.parentElement?.classList.contains('custom-select');
  const optionLabel = element.parentElement?.getAttribute('role') === 'option';
  if (field === 'text' && (selectLabel || optionLabel)) {
    const filter = fieldOption(element, english);
    if (filter !== undefined) return filter;
    return scriptOption(element, english);
  }
  if (field === 'aria-label' && element.closest(filterDialog)) {
    const criterion = /^Criterion (\d+): (.+)$/s.exec(english);
    if (criterion) return `条件 ${criterion[1]}：${criterion[2]}`;
    const remove = /^Remove criterion (\d+)$/.exec(english);
    if (remove) return `移除第 ${remove[1]} 个条件`;
    if (english.endsWith(' polarity')) return english.slice(0,-9) + '的匹配方式';
    if (english.endsWith(' is not')) return english.slice(0,-7) + '不等于';
    if (english.endsWith(' is')) return english.slice(0,-3) + '等于';
  }
  const classes = element.classList;
  if ((field === 'text' && classes.contains('outliner-name')) ||
      ((field === 'aria-label' || field === 'title') && classes.contains('outliner-row'))) return null;
  if (locations.has(english) && (field === 'aria-label' || field === 'text') &&
      (classes.contains('ue-menu-label') || classes.contains('ue-menu-item'))) {
    const facet = element.closest('.nodrag.nowheel > .ue-menu:not(:first-child)');
    const active = facet?.previousElementSibling?.querySelector('button[aria-expanded="true"]');
    if (active?.matches('[aria-label="Filter by location"],[aria-label="按位置筛选"]')) return locations.get(english);
  }
  if (classes.contains('merlin-panel-chip-count') && field === 'text') {
    const count = /^(\d+) (cards?|items?|tools?|hands?)$/.exec(english);
    if (count) {
      const units = count[2].startsWith('card') ? '张卡片' : count[2].startsWith('tool') ? '个工具' : count[2].startsWith('hand') ? '组手牌' : '个项目';
      return `${count[1]} ${units}`;
    }
  }
  if (field === 'aria-label' && element.parentElement?.classList.contains('merlin-panel-chip') && english.startsWith('Remove filter ')) {
    const filter = english.slice('Remove filter '.length);
    return '移除筛选条件：' + (filter === 'Archived' && element.parentElement === element.parentElement.parentElement?.firstElementChild ? '已归档' : filter);
  }
  if (classes.contains('merlin-script-form-inline-status') && field === 'text' && english.startsWith('Appears under: ')) {
    const category = english.slice('Appears under: '.length);
    return '显示在工具架分类：' + (types.get(category) ?? category);
  }
  if (classes.contains('merlin-script-form-group')) {
    // The group is authored data. Only localize standard categories on the shipped, locked graph.
    const locked = element.closest('.merlin-script-form')?.querySelector('.merlin-script-side-locked > span')?.textContent;
    if (locked && (locked.startsWith('This is a built-in graph,') || locked.startsWith('此节点图为内置模板'))) {
      return builtInGroups[english];
    }
  }
  if (field !== 'aria-label' && field !== 'title') return undefined;
  if (classes.contains('merlin-script-form-name') && english.endsWith(' name')) return english.slice(0,-5) + '的名称';
  if (classes.contains('custom-select') && element.parentElement?.parentElement?.classList.contains('merlin-script-form-row') && english.endsWith(' type')) return english.slice(0,-5) + '的类型';
  if (classes.contains('merlin-script-form-dot')) {
    const tile = /^Click to find “(.+)”; drag to place\b.*$/s.exec(english);
    if (tile) return `点击定位“${tile[1]}”，拖动可放置另一个关联图块`;
    const inGraph = /^Click to find “(.+)” in the graph$/s.exec(english);
    if (inGraph) return `点击在节点图中定位“${inGraph[1]}”`;
  }
  if (classes.contains('merlin-script-form-star') && field === 'aria-label') {
    if (english.endsWith(' is the primary output')) return english.slice(0,-' is the primary output'.length) + '是主要输出';
    const mark = /^Mark (.+) as primary output$/s.exec(english);
    if (mark) return `将 ${mark[1]} 设为主要输出`;
    for (const [state, zh] of requirements) if (english.endsWith(': ' + state)) return english.slice(0,-(state.length + 2)) + '：' + zh;
  }
  return undefined;
}