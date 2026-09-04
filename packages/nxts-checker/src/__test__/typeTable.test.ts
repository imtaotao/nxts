import { describe, expect, it } from 'vitest';
import { TypeTable } from '../core/typeTable';
import { equal } from '../core/relation';
import type { ObjectMember } from '../types';

const field = (key: string, type: number, extra?: Partial<ObjectMember>) => ({
  key,
  type,
  optional: false,
  readonly: false,
  role: 'field' as const,
  ...extra,
});

const objectOf = (props: ObjectMember[]) => ({
  kind: 'object' as const,
  props,
  calls: [],
  constructs: [],
});

describe('TypeTable.atom', () => {
  it('reuses TypeId for the same atom', () => {
    const table = new TypeTable();
    const first = table.atom('i32');
    const second = table.atom('i32');
    expect(first).toBe(0);
    expect(second).toBe(first);
    expect(table.types).toHaveLength(1);
    expect(table.types[first]).toMatchObject({ kind: 'atom', atom: 'i32' });
  });

  it('gives i32 and f64 different TypeIds', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const f64 = table.atom('f64');
    expect(equal(i32, f64)).toBe(false);
    expect(equal(i32, table.atom('i32'))).toBe(true);
    expect(table.intern({ kind: 'atom', atom: 'i32' })).toBe(i32);
    expect(table.intern({ kind: 'unknown' })).toBe(
      table.intern({ kind: 'unknown' }),
    );
  });
});

describe('TypeTable.intern', () => {
  it('treats property order as the same object', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const first = table.intern(objectOf([field('x', i32), field('y', text)]));
    const second = table.intern(objectOf([field('y', text), field('x', i32)]));
    expect(second).toBe(first);
    expect(table.types[first]?.kind).toBe('object');
  });

  it('keeps optional, readonly, and object/interface distinct', () => {
    const table = new TypeTable();
    const text = table.atom('string');
    const required = table.intern(objectOf([field('value', text)]));
    const optional = table.intern(
      objectOf([field('value', text, { optional: true })]),
    );
    const readonlyField = table.intern(
      objectOf([field('value', text, { readonly: true })]),
    );
    const contract = table.intern({
      kind: 'interface',
      props: [field('value', text)],
      calls: [],
      constructs: [],
      args: [],
    });
    expect(new Set([required, optional, readonlyField, contract]).size).toBe(4);
    const i32 = table.atom('i32');
    const callsThenEmpty = table.intern({
      kind: 'interface',
      props: [],
      calls: [i32, text],
      constructs: [],
      args: [],
    });
    const callThenArg = table.intern({
      kind: 'interface',
      props: [],
      calls: [i32],
      constructs: [],
      args: [text],
    });
    expect(callsThenEmpty).not.toBe(callThenArg);
    const fn = table.intern({
      kind: 'function',
      signatures: [
        {
          receiver: null,
          params: [{ type: i32, optional: false, rest: false }],
          returnType: text,
        },
      ],
    });
    const ctor = table.intern({
      kind: 'construct',
      signatures: [
        {
          receiver: null,
          params: [{ type: i32, optional: false, rest: false }],
          returnType: text,
        },
      ],
    });
    expect(ctor).not.toBe(fn);
  });

  it('sorts union members and drops never', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const never = table.atom('never');
    const first = table.intern({
      kind: 'union',
      members: [text, i32],
    });
    const second = table.intern({
      kind: 'union',
      members: [i32, never, text],
    });
    expect(second).toBe(first);
    expect(table.intern({ kind: 'union', members: [i32, never] })).toBe(i32);
  });

  it('interns literals, arrays, and nominal decls separately', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const literal = table.intern({
      kind: 'literal',
      base: i32,
      value: { kind: 'numeric', value: '200' },
    });
    const mutable = table.intern({
      kind: 'array',
      element: i32,
      readonly: false,
    });
    const readonlyArray = table.intern({
      kind: 'array',
      element: i32,
      readonly: true,
    });
    const left = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 1 },
      args: [],
    });
    const right = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 2 },
      args: [],
    });
    expect(literal).not.toBe(i32);
    expect(mutable).not.toBe(readonlyArray);
    expect(left).not.toBe(right);
    expect(
      table.intern({
        kind: 'uniqueSymbol',
        decl: { fileId: 0, symbolId: 3 },
      }),
    ).not.toBe(
      table.intern({
        kind: 'uniqueSymbol',
        decl: { fileId: 0, symbolId: 4 },
      }),
    );
  });
});
