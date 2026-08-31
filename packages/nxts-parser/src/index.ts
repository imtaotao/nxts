import { babelParse } from "./babelParse";
import { assignNodeIds } from "./assignNodeIds";
import type { Diagnostic, SourceSpan } from "./types";
import { validate } from "./validator/index";

export type { Diagnostic, SourceSpan };

const spanFrom = (start: number, end = start): SourceSpan => ({
  start,
  end,
  fileId: 0,
  sourceVersion: 0,
});

const diagnosticFromBabel = (e: {
  message: string;
  loc?: { index?: number };
}) => {
  return {
    code: "NXT1000",
    phase: "parser",
    severity: "error",
    messageId: "parser.babel",
    arguments: [e.message],
    primarySpan: spanFrom(e.loc?.index ?? 0),
  } as Diagnostic;
};

export function parseFile(code: string, sourceFilename: string) {
  try {
    const babelAst = babelParse(code, sourceFilename);
    const { nodes, nodeIds, parents } = assignNodeIds(babelAst);
    const diagnostics = [
      ...babelAst.errors.map(diagnosticFromBabel),
      ...validate(nodes, parents),
    ];

    return {
      ast: babelAst,
      nodes,
      nodeIds,
      parents,
      diagnostics,
      complete: diagnostics.length === 0,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ast: null,
      complete: false,
      diagnostics: [diagnosticFromBabel({ message })],
      ...assignNodeIds(null),
    };
  }
}
