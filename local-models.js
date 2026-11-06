const DIR = 'vocoloco-local-models';
export const REQUIRED_LOCAL_MODELS = ['omnivoice-f16.json','omnivoice-f16.bin','decoder-f32.json','decoder-f32.bin','tokenizer.json','omnivoice-config.json','encoder-f32.json','encoder-f32.bin'];
async function dir(create = false) {
  if (!navigator.storage?.getDirectory) throw new Error('Persistent local storage is unavailable in this browser.');
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create });
}
export async function hasLocalModels() {
  try { const d = await dir(); await d.getFileHandle('_complete'); for (const n of REQUIRED_LOCAL_MODELS) { const file = await (await d.getFileHandle(n)).getFile(); if (!file.size) return false; } return true; }
  catch { return false; }
}
export async function importLocalModels(list, progress = () => {}) {
  const files = new Map([...list].map(f => [f.name, f]));
  const missing = REQUIRED_LOCAL_MODELS.filter(n => !files.has(n));
  if (missing.length) throw new Error('Missing files: ' + missing.join(', '));
  const d = await dir(true), total = REQUIRED_LOCAL_MODELS.reduce((s,n) => s + files.get(n).size, 0);
  let loaded = 0;
  for (const n of REQUIRED_LOCAL_MODELS) {
    const w = await (await d.getFileHandle(n,{create:true})).createWritable({keepExistingData:false});
    try {
      const reader = files.get(n).stream().getReader();
      while (true) { const part = await reader.read(); if (part.done) break; await w.write(part.value); loaded += part.value.byteLength; progress({name:n,loaded,total}); }
      await w.close();
    } catch (e) { await w.abort().catch(()=>{}); throw e; }
  }
  const marker = await (await d.getFileHandle('_complete',{create:true})).createWritable();
  await marker.write(String(total)); await marker.close();
  await navigator.storage.persist?.().catch(()=>false);
  return {total};
}
export async function openLocalModel(name) {
  const h = await (await dir()).getFileHandle(name);
  let f = await h.getFile();
  return {size:f.size, async read(offset,bytes) {
    let b = await f.slice(offset,offset+bytes).arrayBuffer();
    if (b.byteLength !== bytes) { f = await h.getFile(); b = await f.slice(offset,offset+bytes).arrayBuffer(); }
    if (b.byteLength !== bytes) throw new Error('Short read: '+name);
    return b;
  }};
}
export async function readLocalJSON(name) {
  const f = await openLocalModel(name);
  return JSON.parse(new TextDecoder().decode(await f.read(0,f.size)));
}
