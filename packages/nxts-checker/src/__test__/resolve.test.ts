import type { Node } from '@babel/types';
import type { BindFileResult } from '@nxts/binder';
import { describe, expect, it } from 'vitest';
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
  if (node == null) {
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
        itemsRecord != null && 'element' in itemsRecord
          ? itemsRecord.element
          : -1
      ],
    ).toMatchObject({ kind: 'atom', atom: 'i32' });
    expect(check.types[point ?? -1]).toMatchObject({ kind: 'object' });
    const pointRecord = check.types[point ?? -1];
    const field =
      pointRecord != null && 'props' in pointRecord
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
      eitherRecord != null && 'members' in eitherRecord
        ? eitherRecord.members
        : [],
    ).toHaveLength(2);
    expect(
      bothRecord != null && 'members' in bothRecord ? bothRecord.members : [],
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
    const ident =
      n?.declNodeId == null ? null : (file.nodes[n.declNodeId] ?? null);
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
      pairRecord != null && 'elements' in pairRecord ? pairRecord.elements : [],
    ).toHaveLength(2);
    expect(
      check.types[
        pairRecord != null && 'elements' in pairRecord
          ? (pairRecord.elements[0]?.type ?? -1)
          : -1
      ],
    ).toMatchObject({ kind: 'atom', atom: 'i32' });
    expect(
      check.types[
        pairRecord != null && 'elements' in pairRecord
          ? (pairRecord.elements[1]?.type ?? -1)
          : -1
      ],
    ).toMatchObject({ kind: 'atom', atom: 'string' });
    expect(check.types[empty ?? -1]).toMatchObject({ kind: 'tuple' });
    expect(
      emptyRecord != null && 'elements' in emptyRecord
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
      option != null && 'elements' in option ? option.elements : [];
    const argsElements =
      args != null && 'elements' in args ? args.elements : [];

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
      record != null && 'elements' in record ? record.elements : [];

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
      record != null && 'signatures' in record ? record.signatures[0] : null;

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
      option != null && 'signatures' in option ? option.signatures[0] : null;
    const restSig =
      rest != null && 'signatures' in rest ? rest.signatures[0] : null;
    const formatSig =
      format != null && 'signatures' in format ? format.signatures[0] : null;

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
      record != null && 'signatures' in record ? record.signatures[0] : null;

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
        codeRecord != null && 'base' in codeRecord ? codeRecord.base : -1
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
      itemsRecord != null && 'element' in itemsRecord
        ? itemsRecord.element
        : null,
    ).toBe(
      frozenRecord != null && 'element' in frozenRecord
        ? frozenRecord.element
        : undefined,
    );
    expect(check.types[pair ?? -1]).toMatchObject({
      kind: 'tuple',
      readonly: true,
    });
    expect(keys).toBeNull();
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
    expect(both).toBeNull();
  });

  it('leaves unknown type AST unhung', async () => {
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
});
