export type TypeId = number;

export type TypeRecord = {
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
