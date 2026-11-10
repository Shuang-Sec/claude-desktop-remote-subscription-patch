import fs from 'node:fs';
// 读取 ASAR，不解包、不执行其中代码。
export function openAsar(filename){
  const fd=fs.openSync(filename,'r'),prefix=Buffer.alloc(16);
  fs.readSync(fd,prefix,0,16,0);
  const bytes=Buffer.alloc(prefix.readUInt32LE(12));fs.readSync(fd,bytes,0,bytes.length,16);
  const header=JSON.parse(bytes),base=8+prefix.readUInt32LE(4),files=[];
  function walk(node,pre=''){for(const [name,entry] of Object.entries(node.files||{})){if(entry.files)walk(entry,pre+name+'/');else files.push({name:pre+name,...entry});}}
  walk(header);
  return {header,headerBytes:bytes,files,read(name){const entry=files.find(f=>f.name===name);if(!entry)throw new Error('文件不存在：'+name);if(entry.unpacked)return fs.readFileSync(filename+'.unpacked/'+name);const out=Buffer.alloc(entry.size);fs.readSync(fd,out,0,out.length,base+Number(entry.offset));return out;},close(){fs.closeSync(fd);}};
}
