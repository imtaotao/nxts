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

export type TypeRecord = {
  id: TypeId;
  kind: AtomKind;
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
  symbolTypes: readonly (TypeId | null)[];
  nodeTypes: readonly (TypeId | null)[];
  nodeReachable: readonly boolean[];
  nodeConstants: readonly null[];
  diagnostics: readonly CheckerDiagnostic[];
  complete: boolean;
};

export type CheckProgramResult = {
  types: readonly TypeRecord[];
  files: readonly CheckFileResult[];
  diagnostics: readonly CheckerDiagnostic[];
  diagnosticsTruncated: boolean;
  complete: boolean;
};
