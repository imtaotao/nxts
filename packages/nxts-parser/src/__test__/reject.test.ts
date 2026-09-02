import type { Node } from '@babel/types';
import { describe, expect, it } from 'vitest';
import { validate } from '../validator/index';
import { messageIds, parseMessageIds } from './utils';

describe('reject', () => {
  it('rejects var', async () => {
    expect(await messageIds('var a = 1')).toContain('parser.var');
  });

  it('rejects == and !=', async () => {
    expect(await messageIds('const x = 1 == 2')).toContain('parser.eqeq');
    expect(await messageIds('const x = 1 != 2')).toContain('parser.eqeq');
  });

  it('rejects any', async () => {
    expect(await messageIds('const x: any = 1')).toContain('parser.any');
  });

  it('rejects bigint literals', async () => {
    expect(await messageIds('const n = 123n')).toContain(
      'parser.bigintLiteral',
    );
  });

  it('rejects the bigint type keyword', async () => {
    expect(await messageIds('const n: bigint = 1 as never')).toContain(
      'parser.bigintKeyword',
    );
  });

  it('rejects the object type keyword', async () => {
    expect(await messageIds('const x: object = {}')).toContain(
      'parser.objectKeyword',
    );
  });

  it('accepts empty object literals', async () => {
    expect(await messageIds('const x = {}')).not.toContain(
      'parser.objectKeyword',
    );
  });

  it('rejects non-null assertions', async () => {
    expect(await messageIds('const y = 1; const x = y!')).toContain(
      'parser.nonNullAssertion',
    );
  });

  it('does not treat definite assignment as a non-null assertion', async () => {
    expect(await messageIds('class A { x!: number }')).not.toContain(
      'parser.nonNullAssertion',
    );
  });

  it('rejects definite assignment', async () => {
    expect(await messageIds('class A { x!: number }')).toContain(
      'parser.definiteAssignment',
    );
  });

  it('accepts class fields without definite assignment', async () => {
    expect(await messageIds('class A { x = 1 }')).not.toContain(
      'parser.definiteAssignment',
    );
  });

  it('rejects angle-bracket type assertions', async () => {
    expect(await messageIds('const x = <number>1')).toContain(
      'parser.typeAssertion',
    );
  });

  it('does not reject as assertions', async () => {
    expect(await messageIds('const x = 1 as number')).not.toContain(
      'parser.typeAssertion',
    );
  });

  it('rejects tagged templates', async () => {
    expect(await messageIds('const x = foo`hi`')).toContain(
      'parser.taggedTemplate',
    );
  });

  it('accepts untagged templates', async () => {
    expect(await messageIds('const x = `hi ${1}`')).not.toContain(
      'parser.taggedTemplate',
    );
  });

  it('rejects JavaScript private names', async () => {
    expect(await messageIds('class A { #x = 1 }')).toContain(
      'parser.privateName',
    );
  });

  it('accepts TypeScript private fields', async () => {
    expect(await messageIds('class A { private x = 1 }')).not.toContain(
      'parser.privateName',
    );
  });

  it('rejects import equals and export equals', async () => {
    expect(await messageIds('import fs = require("fs")')).toContain(
      'parser.importEquals',
    );
    expect(await messageIds('const fs = 1; export = fs')).toContain(
      'parser.importEquals',
    );
  });

  it('accepts static ESM imports', async () => {
    expect(await messageIds('import fs from "fs"')).not.toContain(
      'parser.importEquals',
    );
  });

  it('rejects class auto-accessor nodes', async () => {
    const node = {
      type: 'ClassAccessorProperty',
      start: 0,
      end: 10,
    } as Node;
    expect(
      validate([node]).map((diagnostic) => diagnostic.messageId),
    ).toContain('parser.classAccessor');
  });

  it('accepts class getters', async () => {
    expect(await messageIds('class A { get x() { return 1 } }')).not.toContain(
      'parser.classAccessor',
    );
  });

  it('rejects using declarations', async () => {
    expect(await messageIds('using x = foo()')).toContain('parser.using');
  });

  it('rejects await using declarations', async () => {
    expect(
      await messageIds('async function f() { await using x = foo() }'),
    ).toContain('parser.using');
  });

  it('rejects override', async () => {
    expect(await messageIds('class B extends A { override m() {} }')).toContain(
      'parser.override',
    );
  });

  it('accepts methods without override', async () => {
    expect(await messageIds('class B extends A { m() {} }')).not.toContain(
      'parser.override',
    );
  });

  it('rejects abstract classes and members', async () => {
    expect(await messageIds('abstract class A {}')).toContain(
      'parser.abstract',
    );
    expect(
      await messageIds('abstract class A { abstract m(): void }'),
    ).toContain('parser.abstract');
  });

  it('accepts concrete classes', async () => {
    expect(await messageIds('class A { m() {} }')).not.toContain(
      'parser.abstract',
    );
  });

  it('rejects explicit declare', async () => {
    expect(await messageIds('declare const x: number')).toContain(
      'parser.declare',
    );
    expect(await messageIds('declare function f(): void')).toContain(
      'parser.declare',
    );
  });

  it('does not reject overload signatures without declare', async () => {
    expect(
      await messageIds(
        'function f(a: number): void; function f(a: string): void; function f(a: number | string) {}',
      ),
    ).not.toContain('parser.declare');
  });

  it('rejects namespaces and global augmentation', async () => {
    expect(await messageIds('namespace A {}')).toContain('parser.namespace');
    expect(await messageIds('declare global {}')).toContain('parser.namespace');
  });

  it('rejects bitwise operators', async () => {
    expect(await messageIds('const x = 1 | 2')).toContain('parser.bitwise');
    expect(await messageIds('const x = ~1')).toContain('parser.bitwise');
    expect(await messageIds('let x = 1; x |= 2')).toContain('parser.bitwise');
  });

  it('accepts type-level union and intersection', async () => {
    expect(await messageIds('type T = number | string')).not.toContain(
      'parser.bitwise',
    );
    expect(
      await messageIds('type T = { a: number } & { b: string }'),
    ).not.toContain('parser.bitwise');
  });

  it('rejects object literal getters and setters', async () => {
    expect(await messageIds('const o = { get x() { return 1 } }')).toContain(
      'parser.objectLiteralAccessor',
    );
    expect(await messageIds('const o = { set x(v) {} }')).toContain(
      'parser.objectLiteralAccessor',
    );
  });

  it('accepts object methods, named get properties, and class accessors', async () => {
    expect(await messageIds('const o = { foo() {} }')).not.toContain(
      'parser.objectLiteralAccessor',
    );
    expect(await messageIds('const o = { get: 1 }')).not.toContain(
      'parser.objectLiteralAccessor',
    );
    expect(await messageIds('class A { get x() { return 1 } }')).not.toContain(
      'parser.objectLiteralAccessor',
    );
    expect(await messageIds('class A { set x(v) {} }')).not.toContain(
      'parser.objectLiteralAccessor',
    );
  });

  it('rejects array literal holes', async () => {
    expect(await messageIds('const a = [1, , 2]')).toContain(
      'parser.arrayHole',
    );
    expect(await messageIds('const a = [,]')).toContain('parser.arrayHole');
  });

  it('accepts trailing commas, spreads, and destructuring holes', async () => {
    expect(await messageIds('const a = [1, 2,]')).not.toContain(
      'parser.arrayHole',
    );
    expect(await messageIds('const a = [...xs]')).not.toContain(
      'parser.arrayHole',
    );
    expect(await messageIds('const [a, , b] = xs')).not.toContain(
      'parser.arrayHole',
    );
  });

  it('lets babel reject with, legacy octal, optional assign, and import assertions', async () => {
    expect(await parseMessageIds('with (obj) {}')).toContain('parser.babel');
    expect(await parseMessageIds('const n = 077')).toContain('parser.babel');
    expect(await parseMessageIds('const n = 08')).toContain('parser.babel');
    expect(await parseMessageIds('a?.b = 1')).toContain('parser.unsupported');
    expect(
      await parseMessageIds('import x from "./a.json" assert { type: "json" }'),
    ).toContain('parser.babel');
  });
});
