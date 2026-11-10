import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRemoteModelMenu, ONE_MILLION_MODELS} from '../../scripts/remote-model-menu.mjs';

const models = [
  {value: 'default', resolvedModel: 'claude-opus-5-5', displayName: 'Default (recommended)'},
  {value: 'claude-fable-5-2', resolvedModel: 'claude-fable-5-2', displayName: 'Fable 5.2'},
  {value: 'claude-haiku-4-5-20251001', resolvedModel: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5'}
];
const report = [
  {entrypoint: 'claude-vscode', status: 'success', models},
  {entrypoint: 'claude-desktop', status: 'success', models}
];

test('菜单保留 default/label，并给 Fable 5.2 写入 1M 标记', () => {
  const menu = makeRemoteModelMenu(report);
  assert.equal(menu.length, 3);
  assert.equal(menu[0].name, 'default');
  const fable = menu.find(item => item.name === 'claude-fable-5-2');
  assert.equal(fable.labelOverride, 'Fable 5.2');
  assert.equal(fable.supports1m, true);
  assert.equal(fable.prefer1m, true);
  assert.equal(ONE_MILLION_MODELS.has('claude-fable-5-2'), true);
  const haiku = menu.find(item => item.name === 'claude-haiku-4-5-20251001');
  assert.equal(haiku.supports1m, undefined);
});

test('Desktop 引擎缺少模型时拒绝生成菜单', () => {
  const bad = [{entrypoint: 'claude-vscode', status: 'success', models}, {entrypoint: 'claude-desktop', status: 'success', models: models.slice(0, 2)}];
  assert.throws(() => makeRemoteModelMenu(bad), /Desktop 配套引擎/);
});
