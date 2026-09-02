// 源码快照是解析用的只读原件，不是 AST，也不是缓存。
// parser 只消费快照；fileId / sourceVersion 由调用方会话填写。
// createSnapshot 只做：UTF-8、BOM、text、哈希、行表。
// 读盘、路径规范、按路径发号，不放这里。

const bytesToHex = (bytes: Uint8Array) => {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
};

const sha256Hex = async (bytes: Uint8Array) => {
  const copy = bytes.slice();
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return bytesToHex(new Uint8Array(digest));
};

export type SourceSnapshot = {
  fileId: number;
  sourceVersion: number;
  canonicalPath: string;
  displayPath: string;
  text: string;
  hadBom: boolean;
  contentHash: string;
  lineStarts: readonly number[];
};

export type CreateSnapshotInput = {
  utf8: Uint8Array;
  canonicalPath: string;
  displayPath?: string;
  fileId?: number;
  sourceVersion?: number;
};

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const hasUtf8Bom = (utf8: Uint8Array) => {
  return (
    utf8.length >= 3 && utf8[0] === 0xef && utf8[1] === 0xbb && utf8[2] === 0xbf
  );
};

const buildLineStarts = (text: string) => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x0d && text.charCodeAt(i + 1) === 0x0a) {
      starts.push(i + 2);
      i += 1;
      continue;
    }
    if (code === 0x0a || code === 0x0d || code === 0x2028 || code === 0x2029) {
      starts.push(i + 1);
    }
  }
  return starts;
};

export async function createSnapshot(input: CreateSnapshotInput) {
  const hadBom = hasUtf8Bom(input.utf8);
  const bytes = hadBom ? input.utf8.subarray(3) : input.utf8;
  const text = utf8Decoder.decode(bytes);
  return {
    text,
    hadBom,
    fileId: input.fileId ?? 0,
    sourceVersion: input.sourceVersion ?? 0,
    canonicalPath: input.canonicalPath,
    displayPath: input.displayPath ?? input.canonicalPath,
    contentHash: await sha256Hex(bytes),
    lineStarts: buildLineStarts(text),
  };
}
