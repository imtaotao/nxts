import type { parseFile, SourceSnapshot } from '@nxts/parser';

export type ParseFileResult = ReturnType<typeof parseFile>;

export type NameSpace = 'value' | 'type' | 'label';

export type ScopeKind =
  | 'global'
  | 'module'
  | 'function'
  | 'block'
  | 'class'
  | 'typeParams'
  | 'infer'
  | 'catch'
  | 'label'
  | 'enum';

export type ScopeRecord = {
  id: number;
  kind: ScopeKind;
  parent: number | null;
};

export type SymbolRecord = {
  id: number;
  name: string;
  space: NameSpace;
  scopeId: number;
  // 标准环境符号没有用户 AST 节点。
  declNodeId: number | null;
  // 宿主给的稳定身份。用户声明为 null。
  builtinId: string | null;
};

export type EnvSymbol = {
  name: string;
  space: NameSpace;
  builtinId: string;
};

export type BindEnv = {
  symbols: readonly EnvSymbol[];
};

export type BinderDiagnostic = {
  code: string;
  messageId: string;
  arguments: readonly unknown[];
  phase: 'binder';
  severity: 'error' | 'warning' | 'info';
  primarySpan: {
    start: number;
    end: number;
    fileId: number;
    sourceVersion: number;
  };
};

export type FileExport = {
  name: string;
  space: NameSpace;
  symbolId: number | null;
  source: string | null;
  imported: string | null;
};

export type FileImport = {
  local: string;
  imported: string;
  space: NameSpace;
  source: string;
  symbolId: number;
};

export type ResolveExportResult =
  | { kind: 'found'; fileId: number; symbolId: number }
  | { kind: 'namespace'; fileId: number }
  | { kind: 'missing' }
  | { kind: 'ambiguous' };

export type ResolvedExport =
  | {
      name: string;
      space: NameSpace;
      kind: 'found';
      fileId: number;
      symbolId: number;
    }
  | {
      name: string;
      space: NameSpace;
      kind: 'namespace';
      fileId: number;
    }
  | {
      name: string;
      space: NameSpace;
      kind: 'ambiguous';
    };

export type BindFileResult = {
  // 这次绑定用的源码快照，和 parseFile 是同一份。
  snapshot: SourceSnapshot;
  // 词法作用域树。下标是 ScopeId；parent 指向外层。有标准环境时模块根的 parent 是 global，否则为 null。
  scopes: ScopeRecord[];
  // 声明身份。下标是 SymbolId。标准环境符号带 builtinId，declNodeId 为 null。
  symbols: SymbolRecord[];
  // NodeId → SymbolId[]。下标对齐 parser 的 nodes[]；一个节点可占多个空间，无绑定为空数组。
  nodeToSymbols: number[][];
  // 本文件出口。symbolId 为空表示尚未链到其他模块的再导出。
  exports: FileExport[];
  // 展开后的出口。bindFile 为空数组；bindProgram 按模块边填好。
  resolved: ResolvedExport[];
  // 本文件进口。symbolId 是本地占坑，不表示对方文件的 symbol。
  imports: FileImport[];
  // 绑定诊断，如未声明、重复声明。
  diagnostics: BinderDiagnostic[];
};

export type ModuleEdge = {
  fromFileId: number;
  specifier: string;
  toFileId: number;
};

export type ModuleLink = {
  fromFileId: number;
  importSymbolId: number;
  toFileId: number;
  // 命名空间绑定（import * / export * as）没有单一出口符号。
  exportSymbolId: number | null;
};

export type BindProgramResult = {
  files: BindFileResult[];
  links: ModuleLink[];
  diagnostics: BinderDiagnostic[];
};
