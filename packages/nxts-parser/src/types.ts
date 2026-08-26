import type { File, Node } from "@babel/types";

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
  severity: "error" | "warning" | "info";
  phase: "parser";
};

export type ParseFileResult = {
  ast: File | null;
  complete: boolean;
  diagnostics: Diagnostic[];
  nodes: Node[];
  nodeIds: WeakMap<Node, number>;
};

export type Rule = {
  name: string;
  check: (node: Node) => Diagnostic | null;
};
