import { describe, expect, it } from 'vitest';
import { checkSources, typeSymbol, valueSymbol } from './utils';

describe('checkImports', () => {
  it('copies imported type and value TypeIds across files', async () => {
    const { bind, check } = await checkSources([
      { path: 'count.ts', code: 'export type Count = number;\n' },
      {
        path: 'seed.ts',
        code: "import type { Count } from './count';\nexport const n: Count = 1;\n",
      },
      {
        path: 'main.ts',
        code: "import { n } from './seed';\nconst m: number = n;\n",
      },
    ]);
    const countFile = bind.files[0];
    const seedFile = bind.files[1];
    const mainFile = bind.files[2];
    const count = typeSymbol(countFile, 'Count');
    const imported = typeSymbol(seedFile, 'Count');
    const n = valueSymbol(seedFile, 'n');
    const importedN = valueSymbol(mainFile, 'n');
    const m = valueSymbol(mainFile, 'm');
    const countType = check.files[0]?.symbolTypes[count?.id ?? -1] ?? null;
    const importedType =
      check.files[1]?.symbolTypes[imported?.id ?? -1] ?? null;
    const nType = check.files[1]?.symbolTypes[n?.id ?? -1] ?? null;
    const importedNType =
      check.files[2]?.symbolTypes[importedN?.id ?? -1] ?? null;
    const mType = check.files[2]?.symbolTypes[m?.id ?? -1] ?? null;

    expect(countType).not.toBeNull();
    expect(importedType).toBe(countType);
    expect(nType).toBe(countType);
    expect(importedNType).toBe(nType);
    expect(mType).toBe(countType);
    expect(check.types[countType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
  });
});
