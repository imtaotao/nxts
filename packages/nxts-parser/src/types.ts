import type { File, Node } from '@babel/types';
import type { SourceSnapshot } from './snapshot';

export type SourceSpan = {
  start: number;
  end: number;
  fileId: number;
  sourceVersion: number;
};

export type Diagnostic = {
  code: string;
  messageId: string;
  primarySpan: SourceSpan;
  arguments: readonly unknown[];
  severity: 'error' | 'warning' | 'info';
  phase: 'parser';
};

export type ParseFileResult = {
  ast: File | null;
  snapshot: SourceSnapshot;
  complete: boolean;
  diagnosticsTruncated: boolean;
  diagnostics: Diagnostic[];
  nodes: Node[];
  nodeIds: WeakMap<Node, number>;
  parents: WeakMap<Node, Node>;
  invalidNodes: Set<Node>;
};

export type RuleContext = {
  parent: Node | null;
  parents: WeakMap<Node, Node>;
  invalidNodes: Set<Node>;
  fileId: number;
  sourceVersion: number;
};

export type Rule = {
  name: string;
  check: (node: Node, ctx: RuleContext) => Diagnostic | null;
};
