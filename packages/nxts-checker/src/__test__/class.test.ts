import { describe, expect, it } from 'vitest';
import { checkSource, typeSymbol, valueSymbol } from './utils';

describe('checkClasses', () => {
  it('hangs class instance and constructor as different types', async () => {
    const { bind, check } = await checkSource(
      'class Box {}\nclass Bag {}\nconst box: Box = new Box();\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const boxType = typeSymbol(file, 'Box');
    const boxValue = valueSymbol(file, 'Box');
    const bagType = typeSymbol(file, 'Bag');
    const box = valueSymbol(file, 'box');
    const instance = checked.symbolTypes[boxType?.id ?? -1];
    const ctor = checked.symbolTypes[boxValue?.id ?? -1];
    const other = checked.symbolTypes[bagType?.id ?? -1];

    expect(instance).not.toBeNull();
    expect(ctor).not.toBe(instance);
    expect(other).not.toBe(instance);
    expect(checked.symbolTypes[box?.id ?? -1]).toBe(instance);
    expect(check.types[instance ?? -1]).toMatchObject({ kind: 'class' });
    expect(check.types[ctor ?? -1]).toMatchObject({ kind: 'classCtor' });
  });
});
