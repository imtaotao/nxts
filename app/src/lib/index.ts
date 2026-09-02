import { bindFile } from '@nxts/binder';
import { createSnapshot, parseFile } from '@nxts/parser';

export async function run(source: string) {
  return bindFile(
    parseFile(
      await createSnapshot({
        utf8: new TextEncoder().encode(source),
        canonicalPath: 'test.ts',
      }),
    ),
  );
}
