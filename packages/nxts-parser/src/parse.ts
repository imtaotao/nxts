import { babelParse } from "./babelParse";
import { assignNodeIds } from "./assignNodeIds";
import type { SourceSnapshot } from "./snapshot";
import type { Diagnostic, SourceSpan } from "./types";
import { validate } from "./validator/index";

export function parseFile(snapshot: SourceSnapshot) {
  const spanFrom = (start: number, end = start): SourceSpan => ({
    start,
    end,
    fileId: snapshot.fileId,
    sourceVersion: snapshot.sourceVersion,
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

  try {
    const babelAst = babelParse(snapshot.text, snapshot.displayPath);
    const { nodes, nodeIds, parents } = assignNodeIds(babelAst);
    const diagnostics = [
      ...babelAst.errors.map(diagnosticFromBabel),
      ...validate(nodes, parents, snapshot),
    ];

    return {
      ast: babelAst,
      snapshot,
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
      snapshot,
      complete: false,
      diagnostics: [diagnosticFromBabel({ message })],
      ...assignNodeIds(null),
    };
  }
}
