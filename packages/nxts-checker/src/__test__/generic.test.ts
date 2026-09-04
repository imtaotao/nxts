import { isNil } from 'aidly';
import { describe, expect, it } from 'vitest';
import {
  atomEnv,
  checkSource,
  checkSources,
  genericEnv,
  typeSymbol,
  valueSymbol,
} from './utils';

describe('checkGenerics', () => {
  it('hangs type parameters and uses them on function values', async () => {
    const { bind, check } = await checkSource(
      'function id<T>(value: T): T { return value; }\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const typeParam = typeSymbol(file, 'T');
    const value = valueSymbol(file, 'value');
    const id = valueSymbol(file, 'id');
    const paramType = checked.symbolTypes[typeParam?.id ?? -1];
    const valueType = checked.symbolTypes[value?.id ?? -1];
    const idType = checked.symbolTypes[id?.id ?? -1];

    expect(paramType).not.toBeNull();
    expect(valueType).toBe(paramType);
    expect(check.types[paramType ?? -1]).toMatchObject({ kind: 'typeParam' });
    expect(check.types[idType ?? -1]).toMatchObject({ kind: 'function' });
  });

  it('interns builtin generic instances with a shared constructor', async () => {
    const { bind, check } = await checkSources(
      [
        { path: 'left.ts', code: 'export const left: Array<i32> = [];\n' },
        { path: 'right.ts', code: 'export const right: Array<i32> = [];\n' },
      ],
      genericEnv,
    );
    const left = valueSymbol(bind.files[0], 'left');
    const right = valueSymbol(bind.files[1], 'right');
    const leftType = check.files[0]?.symbolTypes[left?.id ?? -1] ?? null;
    const rightType = check.files[1]?.symbolTypes[right?.id ?? -1] ?? null;

    expect(leftType).not.toBeNull();
    expect(rightType).toBe(leftType);
    expect(check.types[leftType ?? -1]).toMatchObject({
      kind: 'generic',
      decl: { fileId: -1 },
    });
    const leftRecord = check.types[leftType ?? -1];
    const leftArg =
      !isNil(leftRecord) && 'args' in leftRecord ? leftRecord.args[0] : null;
    expect(check.types[leftArg ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
  });

  it('expands transparent generic aliases', async () => {
    const { bind, check } = await checkSource(
      'type Cell<T> = T;\nconst cell: Cell<i32> = 1;\nconst items: i32[] = [];\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const cellAlias = typeSymbol(file, 'Cell');
    const cell = valueSymbol(file, 'cell');
    const items = valueSymbol(file, 'items');
    const cellType = checked.symbolTypes[cell?.id ?? -1];
    const itemsType = checked.symbolTypes[items?.id ?? -1];

    expect(checked.symbolTypes[cellAlias?.id ?? -1]).toBeNull();
    expect(check.types[cellType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[itemsType ?? -1]).toMatchObject({
      kind: 'array',
      readonly: false,
    });
    const itemsRecord = check.types[itemsType ?? -1];
    const element =
      !isNil(itemsRecord) && 'element' in itemsRecord
        ? itemsRecord.element
        : null;
    expect(check.types[element ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
  });

  it('follows imported generic aliases and fills defaults', async () => {
    const { bind, check } = await checkSources(
      [
        {
          path: 'box.ts',
          code: 'export type Box<T = number> = T;\nexport const local: Box<i32> = 1;\n',
        },
        {
          path: 'main.ts',
          code: "import type { Box } from './box';\nconst remote: Box<i32> = 1;\nconst fallback: Box = 2;\n",
        },
      ],
      atomEnv,
    );
    const local = valueSymbol(bind.files[0], 'local');
    const remote = valueSymbol(bind.files[1], 'remote');
    const fallback = valueSymbol(bind.files[1], 'fallback');
    const localType = check.files[0]?.symbolTypes[local?.id ?? -1] ?? null;
    const remoteType = check.files[1]?.symbolTypes[remote?.id ?? -1] ?? null;
    const fallbackType =
      check.files[1]?.symbolTypes[fallback?.id ?? -1] ?? null;

    expect(check.types[localType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(remoteType).toBe(localType);
    expect(check.types[fallbackType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
  });

  it('hangs generic class instances and expanded interface fields', async () => {
    const { bind, check } = await checkSource(
      'class Box<T> {}\ninterface Named<T> { title: T }\nconst box: Box<i32> = new Box();\nconst named: Named<string> = { title: "a" };\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const boxCtor = typeSymbol(file, 'Box');
    const namedCtor = typeSymbol(file, 'Named');
    const box = valueSymbol(file, 'box');
    const named = valueSymbol(file, 'named');
    const boxType = checked.symbolTypes[box?.id ?? -1];
    const namedType = checked.symbolTypes[named?.id ?? -1];

    expect(checked.symbolTypes[boxCtor?.id ?? -1]).toBeNull();
    expect(checked.symbolTypes[namedCtor?.id ?? -1]).toBeNull();
    expect(check.types[boxType ?? -1]).toMatchObject({ kind: 'class' });
    const boxRecord = check.types[boxType ?? -1];
    const boxArg =
      !isNil(boxRecord) && 'args' in boxRecord ? boxRecord.args[0] : null;
    expect(check.types[boxArg ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[namedType ?? -1]).toMatchObject({
      kind: 'interface',
    });
    const namedRecord = check.types[namedType ?? -1];
    const title =
      !isNil(namedRecord) && 'props' in namedRecord
        ? namedRecord.props[0]
        : null;
    expect(title).toMatchObject({ key: 'title' });
    expect(check.types[title?.type ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
  });

  it('keeps unexpanded generic aliases as generic instances', async () => {
    const { bind, check } = await checkSource(
      'type Later = Promise<i32>;\ntype Unwrap<T> = T extends Promise<infer U> ? U : T;\nconst later: Later = 1;\nconst value: Unwrap<Later> = 1;\n',
      genericEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const laterAlias = typeSymbol(file, 'Later');
    const later = valueSymbol(file, 'later');
    const value = valueSymbol(file, 'value');
    const laterType = checked.symbolTypes[laterAlias?.id ?? -1];
    const laterValueType = checked.symbolTypes[later?.id ?? -1];
    const valueType = checked.symbolTypes[value?.id ?? -1];

    expect(laterType).not.toBeNull();
    expect(laterValueType).toBe(laterType);
    expect(check.types[laterType ?? -1]).toMatchObject({ kind: 'generic' });
    expect(check.types[valueType ?? -1]).toMatchObject({ kind: 'generic' });
  });
});
