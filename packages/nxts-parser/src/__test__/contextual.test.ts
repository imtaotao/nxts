import { describe, expect, it } from "vitest";
import { messageIds, parseMessageIds } from "./utils";

describe("contextual", () => {
  it("rejects new.target outside class constructors", async () => {
    expect(await messageIds("function f() { new.target }")).toContain(
      "parser.newTarget",
    );
    expect(await messageIds("class A { m() { new.target } }")).toContain(
      "parser.newTarget",
    );
    expect(await messageIds("class A { static { new.target } }")).toContain(
      "parser.newTarget",
    );
  });

  it("accepts new.target in constructors and their arrows", async () => {
    expect(
      await messageIds("class A { constructor() { new.target } }"),
    ).not.toContain("parser.newTarget");
    expect(
      await messageIds(
        "class A { constructor() { const f = () => new.target } }",
      ),
    ).not.toContain("parser.newTarget");
  });

  it("rejects getter and setter type parameters", async () => {
    expect(await messageIds("class A { get x<T>() { return 1 } }")).toContain(
      "parser.accessorTypeParams",
    );
    expect(await messageIds("class A { set x<T>(v: T) {} }")).toContain(
      "parser.accessorTypeParams",
    );
    expect(
      await messageIds("class A { static get x<T>() { return 1 } }"),
    ).toContain("parser.accessorTypeParams");
  });

  it("accepts class type parameters and method type parameters", async () => {
    expect(
      await messageIds("class A<T> { get x(): T { return 1 as T } }"),
    ).not.toContain("parser.accessorTypeParams");
    expect(await messageIds("class A { m<T>(x: T) {} }")).not.toContain(
      "parser.accessorTypeParams",
    );
  });

  it("rejects as const on variables and calls", async () => {
    expect(await messageIds("const x = y as const")).toContain(
      "parser.asConst",
    );
    expect(await messageIds("const x = foo() as const")).toContain(
      "parser.asConst",
    );
  });

  it("accepts as const on direct literals", async () => {
    expect(await messageIds("const x = 1 as const")).not.toContain(
      "parser.asConst",
    );
    expect(await messageIds("const x = [1, 2] as const")).not.toContain(
      "parser.asConst",
    );
    expect(await messageIds("const x = { a: 1 } as const")).not.toContain(
      "parser.asConst",
    );
    expect(await messageIds("const x = -1 as const")).not.toContain(
      "parser.asConst",
    );
  });

  it("rejects required parameters after optional parameters", async () => {
    expect(await messageIds("function f(a?: number, b: string) {}")).toContain(
      "parser.optionalOrder",
    );
    expect(
      await messageIds("class A { constructor(a?: number, b: string) {} }"),
    ).toContain("parser.optionalOrder");
    expect(
      await messageIds("const f = (a?: number, b: string) => 1"),
    ).toContain("parser.optionalOrder");
    expect(
      await messageIds("class A { m(a?: number, b: string) {} }"),
    ).toContain("parser.optionalOrder");
    expect(
      await messageIds("interface I { m(a?: number, b: string): void }"),
    ).toContain("parser.optionalOrder");
    expect(
      await messageIds("type F = (a?: number, b: string) => void"),
    ).toContain("parser.optionalOrder");
    expect(
      await messageIds("interface I { (a?: number, b: string): void }"),
    ).toContain("parser.optionalOrder");
  });

  it("accepts optional, defaults, and rest after optional", async () => {
    expect(
      await messageIds("function f(a: number, b?: string) {}"),
    ).not.toContain("parser.optionalOrder");
    expect(await messageIds("function f(a?: number, b = 1) {}")).not.toContain(
      "parser.optionalOrder",
    );
    expect(
      await messageIds("function f(a?: number, ...r: string[]) {}"),
    ).not.toContain("parser.optionalOrder");
    expect(await messageIds("type T = [number?, string]")).not.toContain(
      "parser.optionalOrder",
    );
    expect(
      await messageIds("type T = { a?: number; b: string }"),
    ).not.toContain("parser.optionalOrder");
  });

  it("rejects overload signatures without an adjacent implementation", async () => {
    expect(await messageIds("function f(a: number): void;")).toContain(
      "parser.overloadDeclare",
    );
    expect(
      await messageIds(
        "function f(a: number): void; const x = 1; function f(a: number) {}",
      ),
    ).toContain("parser.overloadDeclare");
    expect(
      await messageIds("function f(a: number): void; function g(a: number) {}"),
    ).toContain("parser.overloadDeclare");
  });

  it("rejects overload groups that change export or function kind", async () => {
    expect(
      await messageIds(
        "function f(a: number): void; export function f(a: number) {}",
      ),
    ).toContain("parser.overloadDeclare");
    expect(
      await messageIds(
        "function f(): Promise<number>; async function f() { return 1 }",
      ),
    ).toContain("parser.overloadDeclare");
  });

  it("accepts adjacent same-name overload groups", async () => {
    expect(
      await messageIds(
        "function f(a: number): void; function f(a: string): void; function f(a: number | string) {}",
      ),
    ).not.toContain("parser.overloadDeclare");
    expect(
      await messageIds(
        "export function f(a: number): void; export function f(a: number) {}",
      ),
    ).not.toContain("parser.overloadDeclare");
    expect(
      await messageIds(
        "function o() { function f(a: number): void; function f(a: number) {} }",
      ),
    ).not.toContain("parser.overloadDeclare");
    expect(
      await messageIds(
        "async function f(): Promise<number>; async function f() { return 1 }",
      ),
    ).not.toContain("parser.overloadDeclare");
    expect(
      await messageIds("class A { m(a: number): void; m(a: number) {} }"),
    ).not.toContain("parser.overloadDeclare");
    expect(await messageIds("declare function f(): void;")).not.toContain(
      "parser.overloadDeclare",
    );
  });

  it("rejects class overload signatures without an adjacent implementation", async () => {
    expect(await messageIds("class A { m(a: number): void; }")).toContain(
      "parser.classOverload",
    );
    expect(
      await messageIds(
        "class A { m(a: number): void; n() {} m(a: number) {} }",
      ),
    ).toContain("parser.classOverload");
    expect(await messageIds("class A { constructor(a: number); }")).toContain(
      "parser.classOverload",
    );
  });

  it("rejects class overload groups that change static, kind, or visibility", async () => {
    expect(
      await messageIds(
        "class A { m(a: number): void; static m(a: number) {} }",
      ),
    ).toContain("parser.classOverload");
    expect(
      await messageIds(
        "class A { m(): Promise<number>; async m() { return 1 } }",
      ),
    ).toContain("parser.classOverload");
    expect(
      await messageIds(
        "class A { private m(a: number): void; public m(a: number) {} }",
      ),
    ).toContain("parser.classOverload");
  });

  it("accepts adjacent class method and constructor overload groups", async () => {
    expect(
      await messageIds(
        "class A { m(a: number): void; m(a: string): void; m(a: number | string) {} }",
      ),
    ).not.toContain("parser.classOverload");
    expect(
      await messageIds(
        "class A { constructor(a: number); constructor(a: number) {} }",
      ),
    ).not.toContain("parser.classOverload");
    expect(
      await messageIds(
        "class A { static m(a: number): void; static m(a: number) {} }",
      ),
    ).not.toContain("parser.classOverload");
    expect(
      await messageIds(
        "class A { async m(): Promise<number>; async m() { return 1 } }",
      ),
    ).not.toContain("parser.classOverload");
    expect(
      await messageIds("function f(a: number): void; function f(a: number) {}"),
    ).not.toContain("parser.classOverload");
    expect(await messageIds("class A { declare m(): void }")).not.toContain(
      "parser.classOverload",
    );
  });

  it("rejects multiple concrete tuple rests and optional after rest", async () => {
    expect(
      await messageIds("type T = [...number[], string, ...boolean[]]"),
    ).toContain("parser.tupleRest");
    expect(await messageIds("type T = [...number[], string?]")).toContain(
      "parser.tupleRest",
    );
    expect(await messageIds("type T = [...a: number[], b?: string]")).toContain(
      "parser.tupleRest",
    );
  });

  it("accepts a single rest and TypeScript-legal optional/rest order", async () => {
    expect(await messageIds("type T = [number, ...string[]]")).not.toContain(
      "parser.tupleRest",
    );
    expect(await messageIds("type T = [number, string?]")).not.toContain(
      "parser.tupleRest",
    );
    expect(await messageIds("type T = [...string[], number]")).not.toContain(
      "parser.tupleRest",
    );
    expect(await messageIds("type T = [string?, ...number[]]")).not.toContain(
      "parser.tupleRest",
    );
    expect(await messageIds("type T<A, B> = [...A, ...B]")).not.toContain(
      "parser.tupleRest",
    );
    expect(await messageIds("type T = [number?, string]")).not.toContain(
      "parser.tupleRest",
    );
  });

  it("lets babel reject constructor and interface accessor type parameters", async () => {
    expect(
      await parseMessageIds("class A { constructor<T>(x: T) {} }"),
    ).toContain("parser.babel");
    expect(await parseMessageIds("interface I { get x<T>(): T }")).toContain(
      "parser.babel",
    );
  });

  it("lets babel reject tuple optional-before-required and tuple holes", async () => {
    expect(await parseMessageIds("type T = [number?, string]")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("type T = [a?: number, b: string]")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("type T = [number, , string]")).toContain(
      "parser.babel",
    );
  });

  it("lets babel reject return, await, and yield in illegal positions", async () => {
    expect(await parseMessageIds("return 1")).toContain("parser.babel");
    expect(await parseMessageIds("function f() { await x }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("function f() { yield 1 }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("class A { static { return } }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("class A { static { await x } }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("class A { static { yield 1 } }")).toContain(
      "parser.babel",
    );
    expect(
      await parseMessageIds("class B extends A { static { super() } }"),
    ).toContain("parser.babel");
    expect(
      await parseMessageIds("class A { static <T> { const x = 1 } }"),
    ).toContain("parser.babel");
  });

  it("lets babel reject variance on functions and methods", async () => {
    expect(await parseMessageIds("function f<in T>() {}")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("class A { m<out T>() {} }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("function f<in out T>() {}")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("const f = <in T>() => 1")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("type F = <in T>() => void")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("interface I { m<out T>(): void }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("interface I { <in T>(): void }")).toContain(
      "parser.babel",
    );
  });

  it("rejects const type parameters on interfaces", async () => {
    expect(await messageIds("interface I<const T> {}")).toContain(
      "parser.constTypeParam",
    );
  });

  it("accepts const type parameters on functions, methods, and classes", async () => {
    expect(await messageIds("function f<const T>() {}")).not.toContain(
      "parser.constTypeParam",
    );
    expect(await messageIds("class A<const T> {}")).not.toContain(
      "parser.constTypeParam",
    );
    expect(await messageIds("class A { m<const T>() {} }")).not.toContain(
      "parser.constTypeParam",
    );
    expect(await messageIds("const f = <const T>() => 1")).not.toContain(
      "parser.constTypeParam",
    );
    expect(
      await messageIds("interface I { m<const T>(): void }"),
    ).not.toContain("parser.constTypeParam");
  });

  it("lets babel reject typeof on calls and const type params on aliases", async () => {
    expect(await parseMessageIds("type T = typeof foo()")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("type T = typeof (a && b)")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("type T = typeof import(x)")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("type T = typeof new Foo()")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("type T<const U> = U")).toContain(
      "parser.babel",
    );
  });

  it("lets babel reject illegal break, continue, and labels", async () => {
    expect(await parseMessageIds("break")).toContain("parser.babel");
    expect(await parseMessageIds("continue")).toContain("parser.babel");
    expect(await parseMessageIds("loop: for (;;) { break missing }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("label: { continue label }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("switch (x) { default: continue }")).toContain(
      "parser.babel",
    );
  });

  it("lets babel reject rest that is not last in destructuring", async () => {
    expect(await parseMessageIds("const [a, ...b, c] = xs")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("const [...a, b] = xs")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("const { a, ...b, c } = o")).toContain(
      "parser.babel",
    );
  });

  it("lets babel reject duplicate implementations, illegal super, and top-level new.target", async () => {
    expect(
      await parseMessageIds(
        "function f(): void; function f() {} function f() {}",
      ),
    ).toContain("parser.babel");
    expect(await parseMessageIds("super.x")).toContain("parser.babel");
    expect(await parseMessageIds("new.target")).toContain("parser.babel");
  });

  it("lets babel reject declare methods and abstract members on concrete classes", async () => {
    expect(await parseMessageIds("class A { declare m(): void }")).toContain(
      "parser.babel",
    );
    expect(await parseMessageIds("class A { abstract m(): void }")).toContain(
      "parser.babel",
    );
  });

  it("lets babel reject illegal assignment targets", async () => {
    expect(await parseMessageIds("1 = 2")).toContain("parser.babel");
    expect(await parseMessageIds("(a + b) = 1")).toContain("parser.babel");
    expect(await parseMessageIds("++a?.b")).toContain("parser.unsupported");
  });
});
