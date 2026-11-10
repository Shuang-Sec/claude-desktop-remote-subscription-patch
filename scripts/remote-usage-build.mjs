import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {createPackageFromStreams} from '@electron/asar';
import {openAsar} from './inspect-asar.mjs';

export function patchRemoteUsage({root, staging, replace, hosts}) {
  // 复用副本的 app://localhost 协议；只处理用量 GET，不新增监听端口。
  replace('index.chunk-CUttgRYM.js',
    'if(n&&n!==Yu)return new Response(null,{status:403});let o=r();',
    'if(n&&n!==Yu)return new Response(null,{status:403});if(t.pathname==="/api/oracle-trial/usage"&&e.method==="GET")return require("./oracle-usage.cjs").response(e,u.app.getPath("userData"));let o=r();');
  for (const file of ['oracle-usage.cjs', 'oracle-usage-query.py']) {
    fs.copyFileSync(path.join(root, file), path.join(staging, '.vite', 'build', file));
  }
  const usageFile = path.join(staging, '.vite', 'build', 'oracle-usage.cjs');
  const source = fs.readFileSync(usageFile, 'utf8');
  if (source.split("'__ORACLE_HOSTS__'").length !== 2) throw new Error('oracle-usage 主机占位不唯一');
  fs.writeFileSync(usageFile, source.replace("'__ORACLE_HOSTS__'", JSON.stringify(hosts)));
}

export async function buildRemoteUsageFrontend({root, originalApp, outputApp}) {
  const original = openAsar(path.join(originalApp, 'resources', 'ion-dist.asar'));
  const originalHeaderHash = crypto.createHash('sha256').update(original.headerBytes).digest('hex');
  const component = 'assets/v1/c227f4d5e-DlJFBQoz.js';
  let source = original.read(component).toString('utf8');
  const before = 'q(V_,{...n,liveTokens:i,isFetching:p,compactAction:d})):$[23]}function x4(e)';
  const after = 'q(ut,{children:[q(__OracleRemoteUsage,{sessionRef:c}),q(V_,{...n,liveTokens:i,isFetching:p,compactAction:d})]})):$[23]}function x4(e)';
  if (source.split(before).length !== 2) throw new Error('Usage 弹窗定位不唯一，停止构建');
  source = 'import {OracleRemoteUsage as __OracleRemoteUsage} from "./oracle-usage-ui.js";\n' + source.replace(before, after);
  const changes = new Map([[component, Buffer.from(source)], ['assets/v1/oracle-usage-ui.js', fs.readFileSync(path.join(root, 'oracle-usage-ui.mjs'))]]);
  const streams = [];
  function directories(node, prefix = '') {
    for (const [name, entry] of Object.entries(node.files || {})) {
      const file = prefix + name;
      if (entry.files) {
        streams.push({path: file, type: 'directory', unpacked: false});
        directories(entry, file + '/');
      } else {
        if (entry.unpacked || entry.link) throw new Error('网页资源出现外置文件或链接，停止构建');
        const replacement = changes.get(file), size = replacement?.length ?? entry.size;
        streams.push({path: file, type: 'file', unpacked: false, stat: {size}, streamGenerator: () => Readable.from(replacement ?? original.read(file))});
      }
    }
  }
  directories(original.header);
  const extra = 'assets/v1/oracle-usage-ui.js', bytes = changes.get(extra);
  streams.push({path: extra, type: 'file', unpacked: false, stat: {size: bytes.length}, streamGenerator: () => Readable.from(bytes)});
  try {
    await createPackageFromStreams(outputApp, streams);
  } finally {
    original.close();
  }
  const built = openAsar(outputApp);
  const headerHash = crypto.createHash('sha256').update(built.headerBytes).digest('hex');
  built.close();
  return {modified: [component], added: [extra], originalHeaderHash, headerHash};
}
