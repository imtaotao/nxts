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

export type TypeShape =
  | { kind: 'atom'; atom: AtomKind }
  | { kind: 'unknown' }
  | { kind: 'literal'; base: TypeId; value: LiteralValue }
  | { kind: 'uniqueSymbol'; decl: DeclId }
  | { kind: 'object'; props: readonly ObjectMember[] }
  | {
      kind: 'interface';
      props: readonly ObjectMember[];
      calls: readonly TypeId[];
      args: readonly TypeId[];
    }
  | {
      kind: 'dictionary';
      key: TypeId;
      value: TypeId;
      readonly: boolean;
      props: readonly ObjectMember[];
    }
  | { kind: 'array'; element: TypeId; readonly: boolean }
  | {
      kind: 'tuple';
      elements: readonly TupleElement[];
      readonly: boolean;
    }
  | { kind: 'function'; signatures: readonly FunctionSignature[] }
  | { kind: 'union'; members: readonly TypeId[] }
  | { kind: 'intersection'; members: readonly TypeId[] }
  | { kind: 'brand'; base: TypeId; tag: TypeId }
  | { kind: 'class'; decl: DeclId; args: readonly TypeId[] }
  | { kind: 'classCtor'; decl: DeclId; args: readonly TypeId[] }
  | { kind: 'enum'; decl: DeclId }
  | { kind: 'enumMember'; enum: TypeId; value: LiteralValue }
  | { kind: 'generic'; decl: DeclId; args: readonly TypeId[] }
  | { kind: 'typeParam'; decl: DeclId }
  | { kind: 'this'; classType: TypeId };

export type TypeRecord = TypeShape & {
  id: TypeId;
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
  // 声明类型。下标是该文件 binder 的 SymbolId；收窄不改写。没有类型为空。
  symbolTypes: readonly (TypeId | null)[];
  // 这个位置上的类型。下标对齐 parser 的 nodes[]；可来自注解、推导、上下文或收窄。
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
