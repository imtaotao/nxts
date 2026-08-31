import type { Node } from "@babel/types";
import { describe, expect, it } from "vitest";
import { validate } from "../validator/index";
import { messageIds, parseMessageIds } from "./utils";

describe("reject", () => {
  it("rejects var", () => {
    expect(messageIds("var a = 1")).toContain("parser.var");
  });

  it("rejects == and !=", () => {
    expect(messageIds("const x = 1 == 2")).toContain("parser.eqeq");
    expect(messageIds("const x = 1 != 2")).toContain("parser.eqeq");
  });

  it("rejects any", () => {
    expect(messageIds("const x: any = 1")).toContain("parser.any");
  });

  it("rejects bigint literals", () => {
    expect(messageIds("const n = 123n")).toContain("parser.bigintLiteral");
  });

  it("rejects the bigint type keyword", () => {
    expect(messageIds("const n: bigint = 1 as never")).toContain(
      "parser.bigintKeyword",
    );
  });

  it("rejects the object type keyword", () => {
    expect(messageIds("const x: object = {}")).toContain(
      "parser.objectKeyword",
    );
  });

  it("accepts empty object literals", () => {
    expect(messageIds("const x = {}")).not.toContain("parser.objectKeyword");
  });

  it("rejects non-null assertions", () => {
    expect(messageIds("const y = 1; const x = y!")).toContain(
      "parser.nonNullAssertion",
    );
  });

  it("does not treat definite assignment as a non-null assertion", () => {
    expect(messageIds("class A { x!: number }")).not.toContain(
      "parser.nonNullAssertion",
    );
  });

  it("rejects definite assignment", () => {
    expect(messageIds("class A { x!: number }")).toContain(
      "parser.definiteAssignment",
    );
  });

  it("accepts class fields without definite assignment", () => {
    expect(messageIds("class A { x = 1 }")).not.toContain(
      "parser.definiteAssignment",
    );
  });

  it("rejects angle-bracket type assertions", () => {
    expect(messageIds("const x = <number>1")).toContain("parser.typeAssertion");
  });

  it("does not reject as assertions", () => {
    expect(messageIds("const x = 1 as number")).not.toContain(
      "parser.typeAssertion",
    );
  });

  it("rejects tagged templates", () => {
    expect(messageIds("const x = foo`hi`")).toContain("parser.taggedTemplate");
  });

  it("accepts untagged templates", () => {
    expect(messageIds("const x = `hi ${1}`")).not.toContain(
      "parser.taggedTemplate",
    );
  });

  it("rejects JavaScript private names", () => {
    expect(messageIds("class A { #x = 1 }")).toContain("parser.privateName");
  });

  it("accepts TypeScript private fields", () => {
    expect(messageIds("class A { private x = 1 }")).not.toContain(
      "parser.privateName",
    );
  });

  it("rejects import equals and export equals", () => {
    expect(messageIds('import fs = require("fs")')).toContain(
      "parser.importEquals",
    );
    expect(messageIds("const fs = 1; export = fs")).toContain(
      "parser.importEquals",
    );
  });

  it("accepts static ESM imports", () => {
    expect(messageIds('import fs from "fs"')).not.toContain(
      "parser.importEquals",
    );
  });

  it("rejects class auto-accessor nodes", () => {
    const node = {
      type: "ClassAccessorProperty",
      start: 0,
      end: 10,
    } as Node;
    expect(
      validate([node]).map((diagnostic) => diagnostic.messageId),
    ).toContain("parser.classAccessor");
  });

  it("accepts class getters", () => {
    expect(messageIds("class A { get x() { return 1 } }")).not.toContain(
      "parser.classAccessor",
    );
  });

  it("rejects using declarations", () => {
    expect(messageIds("using x = foo()")).toContain("parser.using");
  });

  it("rejects await using declarations", () => {
    expect(
      messageIds("async function f() { await using x = foo() }"),
    ).toContain("parser.using");
  });

  it("rejects override", () => {
    expect(messageIds("class B extends A { override m() {} }")).toContain(
      "parser.override",
    );
  });

  it("accepts methods without override", () => {
    expect(messageIds("class B extends A { m() {} }")).not.toContain(
      "parser.override",
    );
  });

  it("rejects abstract classes and members", () => {
    expect(messageIds("abstract class A {}")).toContain("parser.abstract");
    expect(messageIds("abstract class A { abstract m(): void }")).toContain(
      "parser.abstract",
    );
  });

  it("accepts concrete classes", () => {
    expect(messageIds("class A { m() {} }")).not.toContain("parser.abstract");
  });

  it("rejects explicit declare", () => {
    expect(messageIds("declare const x: number")).toContain("parser.declare");
    expect(messageIds("declare function f(): void")).toContain(
      "parser.declare",
    );
  });

  it("does not reject overload signatures without declare", () => {
    expect(
      messageIds(
        "function f(a: number): void; function f(a: string): void; function f(a: number | string) {}",
      ),
    ).not.toContain("parser.declare");
  });

  it("rejects namespaces and global augmentation", () => {
    expect(messageIds("namespace A {}")).toContain("parser.namespace");
    expect(messageIds("declare global {}")).toContain("parser.namespace");
  });

  it("rejects bitwise operators", () => {
    expect(messageIds("const x = 1 | 2")).toContain("parser.bitwise");
    expect(messageIds("const x = ~1")).toContain("parser.bitwise");
    expect(messageIds("let x = 1; x |= 2")).toContain("parser.bitwise");
  });

  it("accepts type-level union and intersection", () => {
    expect(messageIds("type T = number | string")).not.toContain(
      "parser.bitwise",
    );
    expect(messageIds("type T = { a: number } & { b: string }")).not.toContain(
      "parser.bitwise",
    );
  });

  it("rejects object literal getters and setters", () => {
    expect(messageIds("const o = { get x() { return 1 } }")).toContain(
      "parser.objectLiteralAccessor",
    );
    expect(messageIds("const o = { set x(v) {} }")).toContain(
      "parser.objectLiteralAccessor",
    );
  });

  it("accepts object methods, named get properties, and class accessors", () => {
    expect(messageIds("const o = { foo() {} }")).not.toContain(
      "parser.objectLiteralAccessor",
    );
    expect(messageIds("const o = { get: 1 }")).not.toContain(
      "parser.objectLiteralAccessor",
    );
    expect(messageIds("class A { get x() { return 1 } }")).not.toContain(
      "parser.objectLiteralAccessor",
    );
    expect(messageIds("class A { set x(v) {} }")).not.toContain(
      "parser.objectLiteralAccessor",
    );
  });

  it("rejects array literal holes", () => {
    expect(messageIds("const a = [1, , 2]")).toContain("parser.arrayHole");
    expect(messageIds("const a = [,]")).toContain("parser.arrayHole");
  });

  it("accepts trailing commas, spreads, and destructuring holes", () => {
    expect(messageIds("const a = [1, 2,]")).not.toContain("parser.arrayHole");
    expect(messageIds("const a = [...xs]")).not.toContain("parser.arrayHole");
    expect(messageIds("const [a, , b] = xs")).not.toContain("parser.arrayHole");
  });

  it("lets babel reject with, legacy octal, optional assign, and import assertions", () => {
    expect(parseMessageIds("with (obj) {}")).toContain("parser.babel");
    expect(parseMessageIds("const n = 077")).toContain("parser.babel");
    expect(parseMessageIds("const n = 08")).toContain("parser.babel");
    expect(parseMessageIds("a?.b = 1")).toContain("parser.babel");
    expect(
      parseMessageIds('import x from "./a.json" assert { type: "json" }'),
    ).toContain("parser.babel");
  });
});
