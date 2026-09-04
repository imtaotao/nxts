import { describe, expect, it } from 'vitest';
import { checkSource, typeSymbol, valueSymbol } from './utils';

describe('checkEnums', () => {
  it('hangs enum names and auto members', async () => {
    const { bind, check } = await checkSource(
      'enum Kind { Ready, Busy = Ready }\nconst kind: Kind = Kind.Ready;\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const kindType = typeSymbol(file, 'Kind');
    const kindValue = valueSymbol(file, 'Kind');
    const ready = valueSymbol(file, 'Ready');
    const busy = valueSymbol(file, 'Busy');
    const kind = valueSymbol(file, 'kind');
    const enumType = checked.symbolTypes[kindType?.id ?? -1];

    expect(enumType).not.toBeNull();
    expect(checked.symbolTypes[kindValue?.id ?? -1]).toBe(enumType);
    expect(checked.symbolTypes[kind?.id ?? -1]).toBe(enumType);
    expect(check.types[enumType ?? -1]).toMatchObject({ kind: 'enum' });
    expect(
      check.types[checked.symbolTypes[ready?.id ?? -1] ?? -1],
    ).toMatchObject({
      kind: 'enumMember',
      value: { kind: 'numeric', value: '0' },
    });
    expect(checked.symbolTypes[busy?.id ?? -1]).toBeNull();
  });
});
