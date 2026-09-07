import { isNil } from 'aidly';
import { describe, expect, it } from 'vitest';
import type { Node } from '@babel/types';
import type { BindFileResult } from '@nxts/binder';
import { atomEnv, checkSource, typeSymbol, valueSymbol } from './utils';

const aliasOf = (nodes: readonly Node[], name: string) => {
  for (const node of nodes) {
    if (node.type === 'TSTypeAliasDeclaration' && node.id.name === name) {
      return node;
    }
  }
  return null;
};

const hungOn = (
  file: BindFileResult,
  nodeTypes: readonly (number | null)[],
  node: Node | null,
) => {
  if (isNil(node)) {
    return null;
  }
  return nodeTypes[file.nodeIds.get(node) ?? -1] ?? null;
};

describe('resolveByType', () => {
  it('resolves keyword atoms', async () => {
    const { bind, check } = await checkSource(
      'type Flag = boolean;\ntype Text = string;\ntype Empty = void;\ntype None = never;\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const flag = checked.symbolTypes[typeSymbol(file, 'Flag')?.id ?? -1];
    const text = checked.symbolTypes[typeSymbol(file, 'Text')?.id ?? -1];
    const empty = checked.symbolTypes[typeSymbol(file, 'Empty')?.id ?? -1];
    const none = checked.symbolTypes[typeSymbol(file, 'None')?.id ?? -1];

    expect(check.types[flag ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'boolean',
    });
    expect(check.types[text ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(check.types[empty ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'void',
    });
    expect(check.types[none ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'never',
    });
  });

  it('resolves arrays and object literals', async () => {
    const { bind, check } = await checkSource(
      'type Items = i32[];\ntype Point = { x: i32 };\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const items = checked.symbolTypes[typeSymbol(file, 'Items')?.id ?? -1];
    const point = checked.symbolTypes[typeSymbol(file, 'Point')?.id ?? -1];
    const itemsAnn = aliasOf(file.nodes, 'Items')?.typeAnnotation ?? null;

    expect(check.types[items ?? -1]).toMatchObject({
      kind: 'array',
      readonly: false,
    });
    expect(hungOn(file, checked.nodeTypes, itemsAnn)).toBe(items);
    const itemsRecord = check.types[items ?? -1];
    expect(
      check.types[
        !isNil(itemsRecord) && 'element' in itemsRecord
          ? itemsRecord.element
          : -1
      ],
    ).toMatchObject({ kind: 'atom', atom: 'i32' });
    expect(check.types[point ?? -1]).toMatchObject({ kind: 'object' });
    const pointRecord = check.types[point ?? -1];
    const field =
      !isNil(pointRecord) && 'props' in pointRecord
        ? pointRecord.props[0]
        : null;
    expect(field).toMatchObject({ key: 'x' });
    expect(check.types[field?.type ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
  });

  it('resolves unions and intersections', async () => {
    const { bind, check } = await checkSource(
      'type Either = string | number;\ntype Both = { title: string } & { n: number };\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const either = checked.symbolTypes[typeSymbol(file, 'Either')?.id ?? -1];
    const both = checked.symbolTypes[typeSymbol(file, 'Both')?.id ?? -1];

    expect(check.types[either ?? -1]).toMatchObject({ kind: 'union' });
    expect(check.types[both ?? -1]).toMatchObject({ kind: 'intersection' });
    const eitherRecord = check.types[either ?? -1];
    const bothRecord = check.types[both ?? -1];
    expect(
      !isNil(eitherRecord) && 'members' in eitherRecord
        ? eitherRecord.members
        : [],
    ).toHaveLength(2);
    expect(
      !isNil(bothRecord) && 'members' in bothRecord ? bothRecord.members : [],
    ).toHaveLength(2);
  });

  it('hangs type references on the name node', async () => {
    const { bind, check } = await checkSource(
      'type Count = number;\nconst n: Count = 1;\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const count = checked.symbolTypes[typeSymbol(file, 'Count')?.id ?? -1];
    const n = valueSymbol(file, 'n');
    const ident = isNil(n?.declNodeId)
      ? null
      : (file.nodes[n.declNodeId] ?? null);
    const ref =
      ident?.type === 'Identifier' &&
      ident.typeAnnotation?.type === 'TSTypeAnnotation'
        ? ident.typeAnnotation.typeAnnotation
        : null;

    expect(checked.symbolTypes[n?.id ?? -1]).toBe(count);
    expect(ref?.type).toBe('TSTypeReference');
    expect(hungOn(file, checked.nodeTypes, ref)).toBe(count);
    expect(
      hungOn(
        file,
        checked.nodeTypes,
        ref?.type === 'TSTypeReference' ? ref.typeName : null,
      ),
    ).toBe(count);
  });

  it('resolves tuples and ignores labels', async () => {
    const { bind, check } = await checkSource(
      'type Pair = [i32, string];\ntype Labeled = [x: i32, y: string];\ntype Empty = [];\nconst pair: Pair = [1, "a"];\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const pair = checked.symbolTypes[typeSymbol(file, 'Pair')?.id ?? -1];
    const labeled = checked.symbolTypes[typeSymbol(file, 'Labeled')?.id ?? -1];
    const empty = checked.symbolTypes[typeSymbol(file, 'Empty')?.id ?? -1];
    const value = valueSymbol(file, 'pair');
    const pairAnn = aliasOf(file.nodes, 'Pair')?.typeAnnotation ?? null;
    const pairRecord = check.types[pair ?? -1];
    const emptyRecord = check.types[empty ?? -1];

    expect(labeled).toBe(pair);
    expect(checked.symbolTypes[value?.id ?? -1]).toBe(pair);
    expect(hungOn(file, checked.nodeTypes, pairAnn)).toBe(pair);
    expect(check.types[pair ?? -1]).toMatchObject({
      kind: 'tuple',
      readonly: false,
    });
    expect(
      !isNil(pairRecord) && 'elements' in pairRecord ? pairRecord.elements : [],
    ).toHaveLength(2);
    expect(
      check.types[
        !isNil(pairRecord) && 'elements' in pairRecord
          ? (pairRecord.elements[0]?.type ?? -1)
          : -1
      ],
    ).toMatchObject({ kind: 'atom', atom: 'i32' });
    expect(
      check.types[
        !isNil(pairRecord) && 'elements' in pairRecord
          ? (pairRecord.elements[1]?.type ?? -1)
          : -1
      ],
    ).toMatchObject({ kind: 'atom', atom: 'string' });
    expect(check.types[empty ?? -1]).toMatchObject({ kind: 'tuple' });
    expect(
      !isNil(emptyRecord) && 'elements' in emptyRecord
        ? emptyRecord.elements
        : null,
    ).toEqual([]);
  });

  it('resolves optional and rest tuple elements', async () => {
    const { bind, check } = await checkSource(
      'type Option = [i32, string?];\ntype Args = [string, ...i32[]];\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const option =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Option')?.id ?? -1] ?? -1
      ];
    const args =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Args')?.id ?? -1] ?? -1
      ];
    const optionElements =
      !isNil(option) && 'elements' in option ? option.elements : [];
    const argsElements =
      !isNil(args) && 'elements' in args ? args.elements : [];

    expect(optionElements).toMatchObject([
      { optional: false, rest: false },
      { optional: true, rest: false },
    ]);
    expect(check.types[optionElements[1]?.type ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(argsElements).toMatchObject([
      { optional: false, rest: false },
      { optional: false, rest: true },
    ]);
    expect(check.types[argsElements[1]?.type ?? -1]).toMatchObject({
      kind: 'array',
      readonly: false,
    });
  });

  it('substitutes generic tuple aliases', async () => {
    const { bind, check } = await checkSource(
      'type Pair<T> = [T, T];\nconst pair: Pair<i32> = [1, 2];\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const pair = checked.symbolTypes[valueSymbol(file, 'pair')?.id ?? -1];
    const record = check.types[pair ?? -1];
    const elements =
      !isNil(record) && 'elements' in record ? record.elements : [];

    expect(check.types[pair ?? -1]).toMatchObject({ kind: 'tuple' });
    expect(elements).toHaveLength(2);
    expect(elements[0]?.type).toBe(elements[1]?.type);
    expect(check.types[elements[0]?.type ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
  });

  it('resolves function types and ignores parameter names', async () => {
    const { bind, check } = await checkSource(
      'type Binary = (left: i32, right: i32) => i32;\ntype Same = (a: i32, b: i32) => i32;\nfunction add(left: i32, right: i32): i32 { return left; }\nconst binary: Binary = add;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const binary = checked.symbolTypes[typeSymbol(file, 'Binary')?.id ?? -1];
    const same = checked.symbolTypes[typeSymbol(file, 'Same')?.id ?? -1];
    const add = checked.symbolTypes[valueSymbol(file, 'add')?.id ?? -1];
    const value = valueSymbol(file, 'binary');
    const binaryAnn = aliasOf(file.nodes, 'Binary')?.typeAnnotation ?? null;
    const record = check.types[binary ?? -1];
    const signature =
      !isNil(record) && 'signatures' in record ? record.signatures[0] : null;

    expect(same).toBe(binary);
    expect(add).toBe(binary);
    expect(checked.symbolTypes[value?.id ?? -1]).toBe(binary);
    expect(hungOn(file, checked.nodeTypes, binaryAnn)).toBe(binary);
    expect(check.types[binary ?? -1]).toMatchObject({ kind: 'function' });
    expect(signature?.receiver ?? null).toBeNull();
    expect(signature?.params).toHaveLength(2);
    expect(check.types[signature?.returnType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
  });

  it('resolves optional, rest, and this in function types', async () => {
    const { bind, check } = await checkSource(
      'type Option = (id: i32, key?: string) => void;\ntype Rest = (initial: i32, ...values: i32[]) => i32;\ntype Format = (this: string, value: i32) => string;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const option =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Option')?.id ?? -1] ?? -1
      ];
    const rest =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Rest')?.id ?? -1] ?? -1
      ];
    const format =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Format')?.id ?? -1] ?? -1
      ];
    const optionSig =
      !isNil(option) && 'signatures' in option ? option.signatures[0] : null;
    const restSig =
      !isNil(rest) && 'signatures' in rest ? rest.signatures[0] : null;
    const formatSig =
      !isNil(format) && 'signatures' in format ? format.signatures[0] : null;

    expect(optionSig?.params).toMatchObject([
      { optional: false, rest: false },
      { optional: true, rest: false },
    ]);
    expect(restSig?.params).toMatchObject([
      { optional: false, rest: false },
      { optional: false, rest: true },
    ]);
    expect(check.types[restSig?.params[1]?.type ?? -1]).toMatchObject({
      kind: 'array',
      readonly: false,
    });
    expect(check.types[formatSig?.receiver ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(formatSig?.params).toHaveLength(1);
  });

  it('substitutes generic function type aliases', async () => {
    const { bind, check } = await checkSource(
      'type MapFn<T> = (value: T) => T;\nconst map: MapFn<i32> = (value: i32): i32 => value;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const map = checked.symbolTypes[valueSymbol(file, 'map')?.id ?? -1];
    const record = check.types[map ?? -1];
    const signature =
      !isNil(record) && 'signatures' in record ? record.signatures[0] : null;

    expect(check.types[map ?? -1]).toMatchObject({ kind: 'function' });
    expect(check.types[signature?.params[0]?.type ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(signature?.returnType).toBe(signature?.params[0]?.type);
  });

  it('resolves boolean, string, and numeric literals', async () => {
    const { bind, check } = await checkSource(
      'type Enabled = true;\ntype Side = "left";\ntype Code = 200;\ntype Negative = -1;\ntype Status = 200 | 404;\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const enabled = checked.symbolTypes[typeSymbol(file, 'Enabled')?.id ?? -1];
    const side = checked.symbolTypes[typeSymbol(file, 'Side')?.id ?? -1];
    const code = checked.symbolTypes[typeSymbol(file, 'Code')?.id ?? -1];
    const negative =
      checked.symbolTypes[typeSymbol(file, 'Negative')?.id ?? -1];
    const status = checked.symbolTypes[typeSymbol(file, 'Status')?.id ?? -1];
    const enabledAnn = aliasOf(file.nodes, 'Enabled')?.typeAnnotation ?? null;

    expect(hungOn(file, checked.nodeTypes, enabledAnn)).toBe(enabled);
    expect(check.types[enabled ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'boolean', value: true },
    });
    expect(check.types[side ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'string', value: 'left' },
    });
    expect(check.types[code ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'numeric', value: '200' },
    });
    const codeRecord = check.types[code ?? -1];
    expect(
      check.types[
        !isNil(codeRecord) && 'base' in codeRecord ? codeRecord.base : -1
      ],
    ).toMatchObject({ kind: 'atom', atom: 'i32' });
    expect(check.types[negative ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'numeric', value: '-1' },
    });
    expect(check.types[status ?? -1]).toMatchObject({ kind: 'union' });
  });

  it('marks arrays and tuples readonly', async () => {
    const { bind, check } = await checkSource(
      'type Items = i32[];\ntype Frozen = readonly i32[];\ntype Pair = readonly [i32, string];\ntype Keys = keyof Items;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const items = checked.symbolTypes[typeSymbol(file, 'Items')?.id ?? -1];
    const frozen = checked.symbolTypes[typeSymbol(file, 'Frozen')?.id ?? -1];
    const pair = checked.symbolTypes[typeSymbol(file, 'Pair')?.id ?? -1];
    const keys = checked.symbolTypes[typeSymbol(file, 'Keys')?.id ?? -1];
    const frozenAnn = aliasOf(file.nodes, 'Frozen')?.typeAnnotation ?? null;
    const itemsRecord = check.types[items ?? -1];
    const frozenRecord = check.types[frozen ?? -1];

    expect(frozen).not.toBe(items);
    expect(hungOn(file, checked.nodeTypes, frozenAnn)).toBe(frozen);
    expect(check.types[items ?? -1]).toMatchObject({
      kind: 'array',
      readonly: false,
    });
    expect(check.types[frozen ?? -1]).toMatchObject({
      kind: 'array',
      readonly: true,
    });
    expect(
      !isNil(itemsRecord) && 'element' in itemsRecord
        ? itemsRecord.element
        : null,
    ).toBe(
      !isNil(frozenRecord) && 'element' in frozenRecord
        ? frozenRecord.element
        : undefined,
    );
    expect(check.types[pair ?? -1]).toMatchObject({
      kind: 'tuple',
      readonly: true,
    });
    expect(check.types[keys ?? -1]).toMatchObject({ kind: 'union' });
    const keyMembers = check.types[keys ?? -1];
    const keyAtoms =
      keyMembers?.kind === 'union'
        ? keyMembers.members.map((member) => check.types[member])
        : [];
    expect(keyAtoms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'atom', atom: 'i32' }),
        expect.objectContaining({
          kind: 'literal',
          value: { kind: 'string', value: 'length' },
        }),
      ]),
    );
  });

  it('resolves keyof of objects and interfaces', async () => {
    const { bind, check } = await checkSource(
      'interface Named { title: string; n: number }\ntype Point = { x: number; y: number };\ntype PointKeys = keyof Point;\ntype NamedKeys = keyof Named;\ntype Only = keyof { id: number };\ntype Empty = keyof {};\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const pointKeys =
      checked.symbolTypes[typeSymbol(file, 'PointKeys')?.id ?? -1];
    const namedKeys =
      checked.symbolTypes[typeSymbol(file, 'NamedKeys')?.id ?? -1];
    const only = checked.symbolTypes[typeSymbol(file, 'Only')?.id ?? -1];
    const empty = checked.symbolTypes[typeSymbol(file, 'Empty')?.id ?? -1];
    const pointAnn = aliasOf(file.nodes, 'PointKeys')?.typeAnnotation ?? null;

    const stringsOf = (typeId: number | null) => {
      const record = check.types[typeId ?? -1];
      if (record?.kind === 'literal' && record.value.kind === 'string') {
        return [record.value.value];
      }
      if (record?.kind !== 'union') {
        return [];
      }
      return record.members.flatMap((member) => {
        const item = check.types[member];
        if (item?.kind === 'literal' && item.value.kind === 'string') {
          return [item.value.value];
        }
        return [];
      });
    };

    expect(hungOn(file, checked.nodeTypes, pointAnn)).toBe(pointKeys);
    expect(check.types[pointKeys ?? -1]).toMatchObject({ kind: 'union' });
    expect(stringsOf(pointKeys).sort()).toEqual(['x', 'y']);
    expect(stringsOf(namedKeys).sort()).toEqual(['n', 'title']);
    expect(check.types[only ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'string', value: 'id' },
    });
    expect(check.types[empty ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'never',
    });
  });

  it('resolves string-literal index access on objects and interfaces', async () => {
    const { bind, check } = await checkSource(
      'interface Named { title: string }\ntype Point = { x: number; y: number };\ntype X = Point["x"];\ntype Title = Named["title"];\ntype Missing = Point["z"];\ntype Both = Point["x" | "y"];\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const x = checked.symbolTypes[typeSymbol(file, 'X')?.id ?? -1];
    const title = checked.symbolTypes[typeSymbol(file, 'Title')?.id ?? -1];
    const missing = checked.symbolTypes[typeSymbol(file, 'Missing')?.id ?? -1];
    const both = checked.symbolTypes[typeSymbol(file, 'Both')?.id ?? -1];
    const xAnn = aliasOf(file.nodes, 'X')?.typeAnnotation ?? null;

    expect(hungOn(file, checked.nodeTypes, xAnn)).toBe(x);
    expect(check.types[x ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
    expect(check.types[title ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(missing).toBeNull();
    expect(check.types[both ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
  });

  it('resolves construct types and callable objects', async () => {
    const { bind, check } = await checkSource(
      'type Make = new (n: i32) => i32;\ntype Same = new (value: i32) => i32;\ntype OnlyNew = { new (n: i32): i32 };\ntype CallObj = { (value: i32): i32; n: i32 };\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const make = checked.symbolTypes[typeSymbol(file, 'Make')?.id ?? -1];
    const same = checked.symbolTypes[typeSymbol(file, 'Same')?.id ?? -1];
    const onlyNew = checked.symbolTypes[typeSymbol(file, 'OnlyNew')?.id ?? -1];
    const callObj = checked.symbolTypes[typeSymbol(file, 'CallObj')?.id ?? -1];
    const makeAnn = aliasOf(file.nodes, 'Make')?.typeAnnotation ?? null;
    const record = check.types[callObj ?? -1];
    const calls = !isNil(record) && 'calls' in record ? record.calls : [];

    expect(hungOn(file, checked.nodeTypes, makeAnn)).toBe(make);
    expect(same).toBe(make);
    expect(onlyNew).toBe(make);
    expect(check.types[make ?? -1]).toMatchObject({ kind: 'construct' });
    expect(check.types[callObj ?? -1]).toMatchObject({ kind: 'object' });
    expect(calls).toHaveLength(1);
    expect(check.types[calls[0] ?? -1]).toMatchObject({ kind: 'function' });
  });

  it('resolves dictionary index signatures', async () => {
    const { bind, check } = await checkSource(
      'type Table = { [key: string]: number };\ntype Frozen = { readonly [key: string]: number };\ntype Mixed = { n: number; [key: string]: number };\ntype Both = { [key: string]: number; [index: number]: number };\ninterface Dict { [key: string]: number }\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const table = checked.symbolTypes[typeSymbol(file, 'Table')?.id ?? -1];
    const frozen = checked.symbolTypes[typeSymbol(file, 'Frozen')?.id ?? -1];
    const mixed = checked.symbolTypes[typeSymbol(file, 'Mixed')?.id ?? -1];
    const both = checked.symbolTypes[typeSymbol(file, 'Both')?.id ?? -1];
    const dict = checked.symbolTypes[typeSymbol(file, 'Dict')?.id ?? -1];
    const tableAnn = aliasOf(file.nodes, 'Table')?.typeAnnotation ?? null;
    const mixedRecord = check.types[mixed ?? -1];

    expect(hungOn(file, checked.nodeTypes, tableAnn)).toBe(table);
    expect(dict).toBe(table);
    expect(frozen).not.toBe(table);
    expect(check.types[table ?? -1]).toMatchObject({
      kind: 'dictionary',
      readonly: false,
    });
    expect(check.types[frozen ?? -1]).toMatchObject({
      kind: 'dictionary',
      readonly: true,
    });
    expect(check.types[mixed ?? -1]).toMatchObject({ kind: 'dictionary' });
    expect(
      !isNil(mixedRecord) && 'props' in mixedRecord ? mixedRecord.props : [],
    ).toHaveLength(1);
    expect(check.types[both ?? -1]).toMatchObject({
      kind: 'dictionary',
    });
    const bothRecord = check.types[both ?? -1];
    expect(
      !isNil(bothRecord) && 'numeric' in bothRecord ? bothRecord.numeric : null,
    ).not.toBeNull();
  });

  it('resolves array and tuple keyof, index, and optional reads', async () => {
    const { bind, check } = await checkSource(
      'type User = { id: i32; nickname?: string };\ntype Left = { id: i32; name: string };\ntype Right = { id: i32; enabled: boolean };\ntype Nick = User["nickname"];\ntype Common = keyof (Left | Right);\ntype Shared = (Left | Right)["id"];\ntype Name = (Left | Right)["name"];\ntype Item = i32[][i32];\ntype Len = i32[]["length"];\ntype First = [string, i32][0];\ntype Wide = [string, i32][i32];\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const nick = checked.symbolTypes[typeSymbol(file, 'Nick')?.id ?? -1];
    const common = checked.symbolTypes[typeSymbol(file, 'Common')?.id ?? -1];
    const shared = checked.symbolTypes[typeSymbol(file, 'Shared')?.id ?? -1];
    const name = checked.symbolTypes[typeSymbol(file, 'Name')?.id ?? -1];
    const item = checked.symbolTypes[typeSymbol(file, 'Item')?.id ?? -1];
    const len = checked.symbolTypes[typeSymbol(file, 'Len')?.id ?? -1];
    const first = checked.symbolTypes[typeSymbol(file, 'First')?.id ?? -1];
    const wide = checked.symbolTypes[typeSymbol(file, 'Wide')?.id ?? -1];

    expect(check.types[nick ?? -1]).toMatchObject({ kind: 'union' });
    expect(check.types[common ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'string', value: 'id' },
    });
    expect(check.types[shared ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(name).toBeNull();
    expect(check.types[item ?? -1]).toMatchObject({ kind: 'union' });
    expect(check.types[len ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[first ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(check.types[wide ?? -1]).toMatchObject({ kind: 'union' });
  });

  it('resolves conditionals, mapped objects, and closed templates', async () => {
    const { bind, check } = await checkSource(
      "type Ready = 'ready' extends string ? true : false;\ntype OnlyString<T> = T extends string ? T : never;\ntype Picked = OnlyString<string | number>;\ntype Whole<T> = [T] extends [string] ? T : never;\ntype Shut = Whole<string | number>;\ntype Point = { x: number; y: number };\ntype Copy = { [K in keyof Point]: Point[K] };\ntype Event = `${'open' | 'close'}Changed`;\n",
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const ready = checked.symbolTypes[typeSymbol(file, 'Ready')?.id ?? -1];
    const picked = checked.symbolTypes[typeSymbol(file, 'Picked')?.id ?? -1];
    const shut = checked.symbolTypes[typeSymbol(file, 'Shut')?.id ?? -1];
    const copy = checked.symbolTypes[typeSymbol(file, 'Copy')?.id ?? -1];
    const event = checked.symbolTypes[typeSymbol(file, 'Event')?.id ?? -1];
    const copyRecord = check.types[copy ?? -1];
    const copyKeys =
      !isNil(copyRecord) && 'props' in copyRecord
        ? copyRecord.props.map((prop) => prop.key).sort()
        : [];

    expect(check.types[ready ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'boolean', value: true },
    });
    expect(check.types[picked ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(check.types[shut ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'never',
    });
    expect(check.types[copy ?? -1]).toMatchObject({ kind: 'object' });
    expect(copyKeys).toEqual(['x', 'y']);
    expect(check.types[event ?? -1]).toMatchObject({ kind: 'union' });
  });

  it('leaves unannotated typeof unhung', async () => {
    const { bind, check } = await checkSource(
      'const n = 1;\ntype Query = typeof n;\n',
    );
    const file = bind.files[0];
    const query = typeSymbol(bind.files[0], 'Query');

    expect(check.files[0]?.symbolTypes[query?.id ?? -1] ?? null).toBeNull();
    expect(aliasOf(file.nodes, 'Query')?.typeAnnotation.type).toBe(
      'TSTypeQuery',
    );
  });

  it('resolves typeof of hung values and unique symbol const', async () => {
    const { bind, check } = await checkSource(
      'const n: i32 = 1;\ntype N = typeof n;\nfunction f(n: i32): i32 { return n; }\ntype F = typeof f;\nclass Box {}\ntype C = typeof Box;\nconst config: { host: string } = { host: "a" };\ntype Host = typeof config.host;\nconst token: unique symbol = Symbol();\ntype Token = typeof token;\nlet bad: unique symbol = Symbol();\ntype Alone = unique symbol;\nenum Kind { Ready }\ntype EnumName = typeof Kind;\ntype Ready = typeof Kind.Ready;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const n = checked.symbolTypes[typeSymbol(file, 'N')?.id ?? -1];
    const fn = checked.symbolTypes[typeSymbol(file, 'F')?.id ?? -1];
    const ctor = checked.symbolTypes[typeSymbol(file, 'C')?.id ?? -1];
    const host = checked.symbolTypes[typeSymbol(file, 'Host')?.id ?? -1];
    const token = checked.symbolTypes[typeSymbol(file, 'Token')?.id ?? -1];
    const tokenValue =
      checked.symbolTypes[valueSymbol(file, 'token')?.id ?? -1];
    const bad = checked.symbolTypes[valueSymbol(file, 'bad')?.id ?? -1];
    const alone = checked.symbolTypes[typeSymbol(file, 'Alone')?.id ?? -1];
    const enumName =
      checked.symbolTypes[typeSymbol(file, 'EnumName')?.id ?? -1];
    const ready = checked.symbolTypes[typeSymbol(file, 'Ready')?.id ?? -1];
    const boxValue = checked.symbolTypes[valueSymbol(file, 'Box')?.id ?? -1];

    expect(check.types[n ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[fn ?? -1]).toMatchObject({ kind: 'function' });
    expect(ctor).toBe(boxValue);
    expect(check.types[ctor ?? -1]).toMatchObject({ kind: 'classCtor' });
    expect(check.types[host ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(token).toBe(tokenValue);
    expect(check.types[token ?? -1]).toMatchObject({ kind: 'uniqueSymbol' });
    expect(bad).toBeNull();
    expect(alone).toBeNull();
    expect(enumName).toBeNull();
    expect(check.types[ready ?? -1]).toMatchObject({ kind: 'enumMember' });
  });
});
