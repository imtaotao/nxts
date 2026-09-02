import type { parseFile, SourceSnapshot } from '@nxts/parser';

export type ParseFileResult = ReturnType<typeof parseFile>;

export type NameSpace = 'value' | 'type' | 'label';

export type ScopeKind =
  | 'module'
  | 'function'
  | 'block'
  | 'class'
  | 'typeParams'
  | 'catch'
  | 'label';

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
  declNodeId: number;
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

export type BindFileResult = {
  // 这次绑定用的源码快照，和 parseFile 是同一份。
  snapshot: SourceSnapshot;
  // 词法作用域树。下标是 ScopeId；parent 指向外层，模块根为 null。
  scopes: ScopeRecord[];
  // 声明身份。下标是 SymbolId，记录名字、空间、所在作用域和声明节点。
  symbols: SymbolRecord[];
  // NodeId → SymbolId。下标对齐 parser 的 nodes[]；不是绑定点的节点为 null。
  nodeToSymbol: Array<number | null>;
  // 绑定诊断，如未声明、重复声明。
  diagnostics: BinderDiagnostic[];
};
