// 32-bit FNV-1a over the UTF-16 units, so the server and both apps agree on it.
export function textHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return hash >>> 0;
}
