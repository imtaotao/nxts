import { describe, expect, it } from 'vitest';
import { createSnapshot } from '../snapshot';

const utf8 = (text: string) => new TextEncoder().encode(text);

const sha256Hex = async (bytes: Uint8Array) => {
  const copy = bytes.slice();
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

describe('createSnapshot', () => {
  it('decodes utf-8 text and defaults identity fields', async () => {
    const snapshot = await createSnapshot({
      utf8: utf8('const x = 1;\n'),
      canonicalPath: 'src/a.ts',
    });
    expect(snapshot.text).toBe('const x = 1;\n');
    expect(snapshot.hadBom).toBe(false);
    expect(snapshot.canonicalPath).toBe('src/a.ts');
    expect(snapshot.displayPath).toBe('src/a.ts');
    expect(snapshot.fileId).toBe(0);
    expect(snapshot.sourceVersion).toBe(0);
    expect(snapshot.lineStarts).toEqual([0, 13]);
    expect(snapshot.contentHash).toBe(await sha256Hex(utf8('const x = 1;\n')));
  });

  it('strips a utf-8 bom and hashes the remaining bytes', async () => {
    const body = utf8('const x = 1;\n');
    const withBom = new Uint8Array(3 + body.length);
    withBom.set([0xef, 0xbb, 0xbf]);
    withBom.set(body, 3);
    const snapshot = await createSnapshot({
      utf8: withBom,
      canonicalPath: 'src/a.ts',
      displayPath: 'a.ts',
      fileId: 3,
      sourceVersion: 2,
    });
    expect(snapshot.hadBom).toBe(true);
    expect(snapshot.text).toBe('const x = 1;\n');
    expect(snapshot.displayPath).toBe('a.ts');
    expect(snapshot.fileId).toBe(3);
    expect(snapshot.sourceVersion).toBe(2);
    expect(snapshot.contentHash).toBe(
      (await createSnapshot({ utf8: body, canonicalPath: 'src/a.ts' }))
        .contentHash,
    );
  });

  it('treats crlf as one line break', async () => {
    const snapshot = await createSnapshot({
      utf8: utf8('a\r\nb'),
      canonicalPath: 'src/a.ts',
    });
    expect(snapshot.lineStarts).toEqual([0, 3]);
  });

  it('indexes other es line terminators without rewriting text', async () => {
    const text = 'a\rb\u2028c\u2029d\n';
    const snapshot = await createSnapshot({
      utf8: utf8(text),
      canonicalPath: 'src/a.ts',
    });
    expect(snapshot.text).toBe(text);
    expect(snapshot.lineStarts).toEqual([0, 2, 4, 6, 8]);
  });

  it('rejects invalid utf-8', async () => {
    await expect(
      createSnapshot({
        utf8: new Uint8Array([0xff]),
        canonicalPath: 'src/a.ts',
      }),
    ).rejects.toThrow();
  });
});
