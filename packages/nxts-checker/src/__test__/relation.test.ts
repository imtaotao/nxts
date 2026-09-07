import { describe, expect, it } from 'vitest';
import { assignable, equal } from '../core/relation';
import { TypeTable } from '../core/typeTable';
import type { FunctionSignature, ObjectMember } from '../types';

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

const fnOf = (
  table: TypeTable,
  params: FunctionSignature['params'],
  returnType: number,
) => {
  return table.intern({
    kind: 'function',
    signatures: [{ receiver: null, params, returnType }],
  });
};

describe('assignable', () => {
  it('accepts equal TypeIds and never as source', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const never = table.atom('never');
    expect(equal(i32, i32)).toBe(true);
    expect(assignable(table, i32, i32)).toBe(true);
    expect(assignable(table, never, text)).toBe(true);
    expect(assignable(table, text, never)).toBe(false);
    expect(assignable(table, table.atom('number'), table.atom('f64'))).toBe(
      false,
    );
  });

  it('widens literals and unique symbols to their base', () => {
    const table = new TypeTable();
    const text = table.atom('string');
    const ready = table.intern({
      kind: 'literal',
      base: text,
      value: { kind: 'string', value: 'ready' },
    });
    const other = table.intern({
      kind: 'literal',
      base: text,
      value: { kind: 'string', value: 'done' },
    });
    const token = table.intern({
      kind: 'uniqueSymbol',
      decl: { fileId: 0, symbolId: 1 },
    });
    expect(assignable(table, ready, text)).toBe(true);
    expect(assignable(table, text, ready)).toBe(false);
    expect(assignable(table, ready, other)).toBe(false);
    expect(assignable(table, token, table.atom('symbol'))).toBe(true);
    expect(assignable(table, table.atom('symbol'), token)).toBe(false);
  });

  it('injects into unions and requires every source member', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const either = table.intern({ kind: 'union', members: [i32, text] });
    expect(assignable(table, i32, either)).toBe(true);
    expect(assignable(table, either, i32)).toBe(false);
    expect(assignable(table, either, either)).toBe(true);
    expect(assignable(table, table.atom('null'), either)).toBe(false);
    expect(
      assignable(
        table,
        table.atom('null'),
        table.intern({
          kind: 'union',
          members: [text, table.atom('null')],
        }),
      ),
    ).toBe(true);
  });

  it('drops brand identity onto the base type', () => {
    const table = new TypeTable();
    const i64 = table.atom('i64');
    const tag = table.intern({
      kind: 'literal',
      base: table.atom('string'),
      value: { kind: 'string', value: 'UserId' },
    });
    const userId = table.intern({ kind: 'brand', base: i64, tag });
    const orderId = table.intern({
      kind: 'brand',
      base: i64,
      tag: table.intern({
        kind: 'literal',
        base: table.atom('string'),
        value: { kind: 'string', value: 'OrderId' },
      }),
    });
    expect(assignable(table, userId, i64)).toBe(true);
    expect(assignable(table, i64, userId)).toBe(false);
    expect(assignable(table, userId, orderId)).toBe(false);
  });

  it('keeps exact object keys and allows mutable to readonly', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const point = table.intern(objectOf([field('x', i32), field('y', i32)]));
    const flipped = table.intern(objectOf([field('y', i32), field('x', i32)]));
    const labeled = table.intern(
      objectOf([field('x', i32), field('y', i32), field('label', text)]),
    );
    const readonlyPoint = table.intern(
      objectOf([
        field('x', i32, { readonly: true }),
        field('y', i32, { readonly: true }),
      ]),
    );
    expect(assignable(table, point, flipped)).toBe(true);
    expect(assignable(table, labeled, point)).toBe(false);
    expect(assignable(table, point, readonlyPoint)).toBe(true);
    expect(assignable(table, readonlyPoint, point)).toBe(false);
  });

  it('packs an object into an interface when members are present', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const labeled = table.intern(
      objectOf([field('x', i32), field('y', i32), field('label', text)]),
    );
    const view = table.intern({
      kind: 'interface',
      props: [field('x', i32), field('y', i32)],
      calls: [],
      constructs: [],
      args: [],
    });
    expect(assignable(table, labeled, view)).toBe(true);
    expect(assignable(table, view, labeled)).toBe(false);
  });

  it('allows mutable arrays onto the same-element readonly view', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const items = table.intern({
      kind: 'array',
      element: i32,
      readonly: false,
    });
    const frozen = table.intern({
      kind: 'array',
      element: i32,
      readonly: true,
    });
    const other = table.intern({
      kind: 'array',
      element: text,
      readonly: true,
    });
    expect(assignable(table, items, frozen)).toBe(true);
    expect(assignable(table, frozen, items)).toBe(false);
    expect(assignable(table, items, other)).toBe(false);
  });

  it('checks function param count and return direction', () => {
    const table = new TypeTable();
    const text = table.atom('string');
    const i32 = table.atom('i32');
    const empty = table.atom('void');
    const never = table.atom('never');
    const consumeValue = fnOf(
      table,
      [{ type: text, optional: false, rest: false }],
      empty,
    );
    const visit = fnOf(
      table,
      [
        { type: text, optional: false, rest: false },
        { type: i32, optional: false, rest: false },
      ],
      empty,
    );
    const createText = fnOf(table, [], text);
    const createNever = fnOf(table, [], never);
    expect(assignable(table, consumeValue, visit)).toBe(true);
    expect(assignable(table, visit, consumeValue)).toBe(false);
    expect(assignable(table, createText, fnOf(table, [], empty))).toBe(false);
    expect(assignable(table, createNever, fnOf(table, [], empty))).toBe(true);
    expect(assignable(table, createNever, createText)).toBe(false);
  });

  it('packs objects into dictionaries and widens number keys', () => {
    const table = new TypeTable();
    const text = table.atom('string');
    const user = table.intern(objectOf([field('name', text)]));
    const labeled = table.intern(
      objectOf([field('name', text), field('city', text)]),
    );
    const frozen = table.intern(
      objectOf([field('name', text, { readonly: true })]),
    );
    const strings = table.intern({
      kind: 'dictionary',
      key: table.atom('string'),
      value: text,
      readonly: false,
      props: [],
    });
    const readonlyStrings = table.intern({
      kind: 'dictionary',
      key: table.atom('string'),
      value: text,
      readonly: true,
      props: [],
    });
    const numbers = table.intern({
      kind: 'dictionary',
      key: table.atom('number'),
      value: text,
      readonly: false,
      props: [],
    });
    expect(assignable(table, user, strings)).toBe(true);
    expect(assignable(table, labeled, strings)).toBe(true);
    expect(assignable(table, frozen, strings)).toBe(false);
    expect(assignable(table, strings, readonlyStrings)).toBe(true);
    expect(assignable(table, readonlyStrings, strings)).toBe(false);
    expect(assignable(table, numbers, strings)).toBe(true);
    expect(assignable(table, strings, numbers)).toBe(false);
    expect(assignable(table, user, numbers)).toBe(false);
    const items = table.intern({
      kind: 'array',
      element: text,
      readonly: false,
    });
    const index = table.intern({
      kind: 'dictionary',
      key: table.atom('number'),
      value: text,
      readonly: true,
      props: [],
    });
    expect(assignable(table, items, index)).toBe(true);
    expect(assignable(table, items, numbers)).toBe(false);
  });

  it('allows isomorphic readonly tuple views and optional length shapes', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const pair = table.intern({
      kind: 'tuple',
      elements: [
        { type: i32, optional: false, rest: false },
        { type: i32, optional: false, rest: false },
      ],
      readonly: false,
    });
    const mixed = table.intern({
      kind: 'tuple',
      elements: [
        { type: i32, optional: false, rest: false },
        { type: text, optional: false, rest: false },
      ],
      readonly: false,
    });
    const optional = table.intern({
      kind: 'tuple',
      elements: [
        { type: i32, optional: false, rest: false },
        { type: text, optional: true, rest: false },
      ],
      readonly: true,
    });
    const frozen = table.intern({
      kind: 'array',
      element: i32,
      readonly: true,
    });
    const writable = table.intern({
      kind: 'array',
      element: i32,
      readonly: false,
    });
    expect(assignable(table, pair, frozen)).toBe(true);
    expect(assignable(table, pair, writable)).toBe(false);
    expect(assignable(table, mixed, frozen)).toBe(false);
    expect(assignable(table, mixed, optional)).toBe(true);
    expect(assignable(table, optional, mixed)).toBe(false);
    const rest = table.intern({
      kind: 'tuple',
      elements: [
        { type: i32, optional: false, rest: false },
        {
          type: table.intern({
            kind: 'array',
            element: i32,
            readonly: false,
          }),
          optional: false,
          rest: true,
        },
      ],
      readonly: false,
    });
    expect(assignable(table, rest, frozen)).toBe(true);
  });

  it('packs a wider interface into a narrower one', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const entity = table.intern({
      kind: 'interface',
      props: [field('id', i32)],
      calls: [],
      constructs: [],
      args: [],
    });
    const user = table.intern({
      kind: 'interface',
      props: [field('id', i32), field('name', text)],
      calls: [],
      constructs: [],
      args: [],
    });
    expect(assignable(table, user, entity)).toBe(true);
    expect(assignable(table, entity, user)).toBe(false);
  });

  it('covers target overloads and rest parameters', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
    const text = table.atom('string');
    const items = table.intern({
      kind: 'array',
      element: i32,
      readonly: false,
    });
    const rest = fnOf(
      table,
      [
        { type: i32, optional: false, rest: false },
        { type: items, optional: false, rest: true },
      ],
      i32,
    );
    const three = fnOf(
      table,
      [
        { type: i32, optional: false, rest: false },
        { type: i32, optional: false, rest: false },
        { type: i32, optional: false, rest: false },
      ],
      i32,
    );
    const parse = table.intern({
      kind: 'function',
      signatures: [
        {
          receiver: null,
          params: [{ type: i32, optional: false, rest: false }],
          returnType: text,
        },
        {
          receiver: null,
          params: [{ type: text, optional: false, rest: false }],
          returnType: text,
        },
        {
          receiver: null,
          params: [
            { type: table.atom('boolean'), optional: false, rest: false },
          ],
          returnType: text,
        },
      ],
    });
    const parser = table.intern({
      kind: 'function',
      signatures: [
        {
          receiver: null,
          params: [{ type: i32, optional: false, rest: false }],
          returnType: text,
        },
        {
          receiver: null,
          params: [{ type: text, optional: false, rest: false }],
          returnType: text,
        },
      ],
    });
    const format = table.intern({
      kind: 'function',
      signatures: [
        {
          receiver: text,
          params: [{ type: i32, optional: false, rest: false }],
          returnType: text,
        },
      ],
    });
    expect(assignable(table, rest, three)).toBe(true);
    expect(assignable(table, three, rest)).toBe(false);
    expect(assignable(table, parse, parser)).toBe(true);
    expect(assignable(table, parser, parse)).toBe(false);
    expect(assignable(table, format, format)).toBe(true);
    expect(
      assignable(
        table,
        format,
        fnOf(table, [{ type: i32, optional: false, rest: false }], text),
      ),
    ).toBe(false);
  });

  it('leaves undetermined class and unknown relations empty', () => {
    const table = new TypeTable();
    const dog = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 1 },
      args: [],
    });
    const animal = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 2 },
      args: [],
    });
    const boxed = table.intern({ kind: 'unknown' });
    expect(assignable(table, dog, animal)).toBe(false);
    expect(assignable(table, table.atom('i32'), boxed)).toBe(false);
  });

  it('assigns a derived class to its base along extends', () => {
    const table = new TypeTable();
    const animal = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 1 },
      args: [],
    });
    const dog = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 2 },
      args: [],
    });
    const cat = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 3 },
      args: [],
    });
    table.classBodies.set(animal, { extends: null, props: [] });
    table.classBodies.set(dog, { extends: animal, props: [] });
    table.classBodies.set(cat, { extends: null, props: [] });

    expect(assignable(table, dog, animal)).toBe(true);
    expect(assignable(table, animal, dog)).toBe(false);
    expect(assignable(table, dog, cat)).toBe(false);
  });

  it('walks a longer class extends chain', () => {
    const table = new TypeTable();
    const animal = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 1 },
      args: [],
    });
    const mammal = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 2 },
      args: [],
    });
    const dog = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 3 },
      args: [],
    });
    table.classBodies.set(animal, { extends: null, props: [] });
    table.classBodies.set(mammal, { extends: animal, props: [] });
    table.classBodies.set(dog, { extends: mammal, props: [] });

    expect(assignable(table, dog, mammal)).toBe(true);
    expect(assignable(table, dog, animal)).toBe(true);
    expect(assignable(table, mammal, dog)).toBe(false);
  });

  it('packs a class into an interface from instance fields', () => {
    const table = new TypeTable();
    const num = table.atom('number');
    const text = table.atom('string');
    const point = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 1 },
      args: [],
    });
    const view = table.intern({
      kind: 'interface',
      props: [field('x', num)],
      calls: [],
      constructs: [],
      args: [],
    });
    const labeled = table.intern({
      kind: 'interface',
      props: [field('x', num), field('label', text)],
      calls: [],
      constructs: [],
      args: [],
    });
    table.classBodies.set(point, {
      extends: null,
      props: [field('x', num), field('y', num)],
    });

    expect(assignable(table, point, view)).toBe(true);
    expect(assignable(table, point, labeled)).toBe(false);
    expect(assignable(table, view, point)).toBe(false);
  });

  it('relates nested class fields when packing into an interface', () => {
    const table = new TypeTable();
    const animal = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 1 },
      args: [],
    });
    const dog = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 2 },
      args: [],
    });
    const box = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 3 },
      args: [],
    });
    const view = table.intern({
      kind: 'interface',
      props: [field('value', animal, { readonly: true })],
      calls: [],
      constructs: [],
      args: [],
    });
    table.classBodies.set(animal, { extends: null, props: [] });
    table.classBodies.set(dog, { extends: animal, props: [] });
    table.classBodies.set(box, {
      extends: null,
      props: [field('value', dog, { readonly: true })],
    });

    expect(assignable(table, box, view)).toBe(true);
  });

  it('rejects same-shape classes without extends', () => {
    const table = new TypeTable();
    const i32 = table.atom('i32');
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
    const props = [field('value', i32)];
    table.classBodies.set(left, { extends: null, props });
    table.classBodies.set(right, { extends: null, props });

    expect(assignable(table, left, right)).toBe(false);
    expect(assignable(table, right, left)).toBe(false);
  });

  it('rejects writable class fields that only relate one way', () => {
    const table = new TypeTable();
    const animal = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 1 },
      args: [],
    });
    const dog = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 2 },
      args: [],
    });
    const box = table.intern({
      kind: 'class',
      decl: { fileId: 0, symbolId: 3 },
      args: [],
    });
    const view = table.intern({
      kind: 'interface',
      props: [field('value', animal)],
      calls: [],
      constructs: [],
      args: [],
    });
    table.classBodies.set(animal, { extends: null, props: [] });
    table.classBodies.set(dog, { extends: animal, props: [] });
    table.classBodies.set(box, {
      extends: null,
      props: [field('value', dog)],
    });

    expect(assignable(table, box, view)).toBe(false);
  });
});
