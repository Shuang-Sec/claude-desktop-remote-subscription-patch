// 采用同一账户的真实初始化目录，保留默认选项，其他选项使用精确模型版本。
// Fable 5.2 的 1M 能力需要随菜单写入，否则 3P 菜单会按未知模型回退到 200k。
export const ONE_MILLION_MODELS = new Set(['claude-fable-5-2']);

export function makeRemoteModelMenu(report) {
  const vscode = report.find(entry => entry.entrypoint === 'claude-vscode' && entry.status === 'success');
  const desktop = report.find(entry => entry.entrypoint === 'claude-desktop' && entry.status === 'success');
  if (!vscode?.models?.length || !desktop?.models?.length) throw new Error('远端模型初始化目录不完整。');
  const desktopIds = new Set(desktop.models.map(model => model.resolvedModel));
  const menu = vscode.models.map(model => {
    if (typeof model.resolvedModel !== 'string' || !/^claude-[a-z0-9-]+$/.test(model.resolvedModel) || !desktopIds.has(model.resolvedModel)) {
      throw new Error('Desktop 配套引擎尚未提供此模型：' + model.displayName);
    }
    const oneMillion = ONE_MILLION_MODELS.has(model.resolvedModel);
    return {
      name: model.value === 'default' ? 'default' : model.resolvedModel,
      labelOverride: model.displayName,
      ...oneMillion && {supports1m: true, prefer1m: true}
    };
  });
  if (new Set(menu.map(model => model.name)).size !== menu.length) throw new Error('模型标识发生重复，拒绝覆盖菜单。');
  return menu;
}
