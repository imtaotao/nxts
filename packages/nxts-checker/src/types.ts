export type TypeId = number;

export type AtomKind =
  | 'boolean'
  | 'number'
  | 'string'
  | 'symbol'
  | 'null'
  | 'undefined'
  | 'i8'
  | 'i16'
  | 'i32'
  | 'i64'
  | 'u8'
  | 'u16'
  | 'u32'
  | 'u64'
  | 'f32'
  | 'f64'
  | 'usize'
  | 'isize'
  | 'void'
  | 'never';

export type DeclId = {
  fileId: number;
  symbolId: number;
};

export type MemberRole = 'field' | 'method' | 'get' | 'set';

export type ObjectMember = {
  key: string;
  type: TypeId;
  optional: boolean;
  readonly: boolean;
  role: MemberRole;
};

// 类实例侧表。不进 TypeRecord / typeKey，按 TypeId 挂在 TypeTable.classBodies。
export type ClassBody = {
  extends: TypeId | null;
  props: readonly ObjectMember[];
};

export type FunctionParam = {
  type: TypeId;
  optional: boolean;
  rest: boolean;
};

export type FunctionSignature = {
  receiver: TypeId | null;
  params: readonly FunctionParam[];
  returnType: TypeId;
};

export type TupleElement = {
  type: TypeId;
  optional: boolean;
  rest: boolean;
};

export type LiteralValue =
  | { kind: 'boolean'; value: boolean }
  | { kind: 'string'; value: string }
  | { kind: 'numeric'; value: string };

// 一次检查的规范类型条目。挂钩表只存 TypeId，问「这个号是什么」查 types[]。
// 条件 / infer / 映射 / 模板是类型运算，闭合后落到下面已有 kind，不新开条目。
// TODO: `x is T` 是收窄谓词，不是返回值 kind。继续：T06 已定；谓词挂在 flow/narrow，不进 types[]。
export type TypeShape =
  | { kind: 'atom'; atom: AtomKind }
  // TODO: 不能用来冒充 any；关键字 any/unknown 由诊断拒绝。继续：等 catalog 接上拒绝诊断。
  | { kind: 'unknown' }
  | { kind: 'literal'; base: TypeId; value: LiteralValue }
  // unique symbol 是声明身份。`const x: unique symbol` 与 `const x = Symbol()` 都挂这里。
  | { kind: 'uniqueSymbol'; decl: DeclId }
  | {
      kind: 'object';
      props: readonly ObjectMember[];
      calls: readonly TypeId[];
      constructs: readonly TypeId[];
    }
  | {
      kind: 'interface';
      props: readonly ObjectMember[];
      calls: readonly TypeId[];
      constructs: readonly TypeId[];
      args: readonly TypeId[];
    }
  // hang：`[key: string | number]: V`。双索引时 `key/value` 是字符串索引，`numeric` 是数值索引。symbol 键 T18 不支持。
  | {
      kind: 'dictionary';
      key: TypeId;
      value: TypeId;
      readonly: boolean;
      props: readonly ObjectMember[];
      numeric?: {
        key: TypeId;
        value: TypeId;
        readonly: boolean;
      } | null;
    }
  | { kind: 'array'; element: TypeId; readonly: boolean }
  | {
      kind: 'tuple';
      elements: readonly TupleElement[];
      readonly: boolean;
    }
  | { kind: 'function'; signatures: readonly FunctionSignature[] }
  | { kind: 'construct'; signatures: readonly FunctionSignature[] }
  | { kind: 'union'; members: readonly TypeId[] }
  | { kind: 'intersection'; members: readonly TypeId[] }
  // TODO: 品牌行。继续：T16 已定；等 T49 把 Brand 的 builtinId / 标准库身份定下来，hang 才能认 Brand<T, Tag>。
  | { kind: 'brand'; base: TypeId; tag: TypeId }
  // 成员不进这条，挂在字段节点上。
  | { kind: 'class'; decl: DeclId; args: readonly TypeId[] }
  | { kind: 'classCtor'; decl: DeclId; args: readonly TypeId[] }
  | { kind: 'enum'; decl: DeclId }
  // `typeof Enum` 的编译期命名空间。成员在 TypeTable.enumNamespaces，不进驻留键。
  | { kind: 'enumNamespace'; enum: TypeId }
  | { kind: 'enumMember'; enum: TypeId; value: LiteralValue }
  | { kind: 'generic'; decl: DeclId; args: readonly TypeId[] }
  | { kind: 'typeParam'; decl: DeclId }
  // TODO: this 要绑到当前实例 TypeId。继续：等 T56 `this`/`super` 类型文档定稿，再由 check/this 写入 classType。
  | { kind: 'this'; classType: TypeId };

export type TypeRecord = TypeShape & {
  id: TypeId;
};

export type DisplayMember = {
  key: string;
  type: DisplayShape;
  optional: boolean;
  readonly: boolean;
  role: MemberRole;
};

// 诊断用的规范形状树。与图鉴同构，不含 TypeId。回边用 cycle。
export type DisplayShape =
  | { kind: 'atom'; atom: AtomKind }
  | { kind: 'unknown' }
  | { kind: 'literal'; base: DisplayShape; value: LiteralValue }
  | { kind: 'uniqueSymbol'; name: string | null }
  | {
      kind: 'object';
      props: readonly DisplayMember[];
      calls: readonly DisplayShape[];
      constructs: readonly DisplayShape[];
    }
  | {
      kind: 'interface';
      name: string | null;
      props: readonly DisplayMember[];
      calls: readonly DisplayShape[];
      constructs: readonly DisplayShape[];
      args: readonly DisplayShape[];
    }
  | {
      kind: 'dictionary';
      key: DisplayShape;
      value: DisplayShape;
      readonly: boolean;
      props: readonly DisplayMember[];
      numeric: {
        key: DisplayShape;
        value: DisplayShape;
        readonly: boolean;
      } | null;
    }
  | { kind: 'array'; element: DisplayShape; readonly: boolean }
  | {
      kind: 'tuple';
      elements: readonly {
        type: DisplayShape;
        optional: boolean;
        rest: boolean;
      }[];
      readonly: boolean;
    }
  | {
      kind: 'function' | 'construct';
      signatures: readonly {
        receiver: DisplayShape | null;
        params: readonly {
          type: DisplayShape;
          optional: boolean;
          rest: boolean;
        }[];
        returnType: DisplayShape;
      }[];
    }
  | { kind: 'union' | 'intersection'; members: readonly DisplayShape[] }
  | { kind: 'brand'; base: DisplayShape; tag: DisplayShape }
  | { kind: 'class' | 'classCtor' | 'generic'; name: string | null }
  | { kind: 'enum'; name: string | null }
  | { kind: 'enumNamespace'; name: string | null }
  | { kind: 'enumMember'; enum: DisplayShape; value: LiteralValue }
  | { kind: 'typeParam'; name: string | null }
  | { kind: 'this'; classType: DisplayShape }
  | { kind: 'cycle' };

export type TypeDisplay = {
  primary: string;
  path: readonly string[];
  canonical: DisplayShape;
};

export type CheckerDiagnostic = {
  code: string;
  messageId: string;
  arguments: readonly unknown[];
  phase: 'checker';
  severity: 'error' | 'warning' | 'info';
  primarySpan: {
    start: number;
    end: number;
    fileId: number;
    sourceVersion: number;
  };
};

export type CheckFileResult = {
  // 这个名字(符号)是什么类型。下标是该文件 binder 的 SymbolId。收窄不改这格。
  symbolTypes: readonly (TypeId | null)[];
  // 源码 ast 节点这个位置是什么类型。下标对齐 parser 的 nodes[]。
  nodeTypes: readonly (TypeId | null)[];
  // 该节点是否顺序可达。下标对齐 parser 的 nodes[]。
  nodeReachable: readonly boolean[];
  // 编译期已提交的运行时值。下标对齐 parser 的 nodes[]；算不出为空。
  nodeConstants: readonly null[];
  // 本文件检查诊断。
  diagnostics: readonly CheckerDiagnostic[];
  // 本文件是否查完。预算耗尽或未走到的格子为空，不能当合法类型。
  complete: boolean;
};

export type CheckProgramResult = {
  // 这次检查的规范类型图鉴。下标是 TypeId，相同类型共用一条。
  types: readonly TypeRecord[];
  // 每文件挂钩表，顺序对齐 bindProgram 的 files。
  files: readonly CheckFileResult[];
  // 程序级检查诊断。
  diagnostics: readonly CheckerDiagnostic[];
  // 诊断是否因预算被截断。
  diagnosticsTruncated: boolean;
  // 整个程序是否查完。未完整不能出可执行 HIR。
  complete: boolean;
};
