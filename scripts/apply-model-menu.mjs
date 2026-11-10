import fs from 'node:fs';
import path from 'node:path';
import {loadConfig, resolveProviderConfig} from './lib/config.mjs';
import {makeRemoteModelMenu} from './remote-model-menu.mjs';

const config = loadConfig();
const catalogFile = config.modelCatalogFile;
const source = process.argv[2] ? path.resolve(process.argv[2]) : catalogFile;
if (source !== catalogFile && source !== catalogFile + '.candidate') throw new Error('模型目录输入不在允许的位置。');
const bytes = fs.readFileSync(source);
const menu = makeRemoteModelMenu(JSON.parse(bytes));
const file = resolveProviderConfig(config);
const provider = JSON.parse(fs.readFileSync(file, 'utf8'));
provider.inferenceModels = menu;
fs.writeFileSync(file, JSON.stringify(provider, null, 2) + '\n');
if (source !== catalogFile) {
  if (fs.existsSync(catalogFile)) fs.writeFileSync(catalogFile + '.previous', fs.readFileSync(catalogFile));
  fs.writeFileSync(catalogFile, bytes);
  fs.unlinkSync(source);
}
console.log(JSON.stringify({models: menu.length, names: menu.map(model => model.labelOverride)}));
