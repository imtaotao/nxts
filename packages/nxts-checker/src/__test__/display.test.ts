import { describe, expect, it } from 'vitest';
import { Display } from '../core/display';
import { TypeTable } from '../core/typeTable';

describe('Display', () => {
  it('copies atoms and literals without TypeId', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const one = table.intern({
      kind: 'literal',
      base: i32,
      value: { kind: 'numeric', value: '1' },
    });
    const shown = new Display(table).of(one);

    expect(shown.primary).toBe('1');
    expect(shown.path).toEqual(['1']);
    expect(shown.canonical).toEqual({
      kind: 'literal',
      base: { kind: 'atom', atom: 'i32' },
      value: { kind: 'numeric', value: '1' },
    });
    expect(JSON.stringify(shown).includes('"id":')).toBe(false);
  });
});
