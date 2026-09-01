import { validate } from "./validator";
import { babelParse } from "./babel";
import { assignNodeIds } from "./nodeIds";
import { diagnosticFromBabel } from "./diagnostics/babel";
import { finalizeDiagnostics } from "./diagnostics/finalize";
import type { SourceSnapshot } from "./snapshot";

export function parseFile(snapshot: SourceSnapshot) {
  try {
    const babelAst = babelParse(snapshot.text, snapshot.displayPath);
    const assigned = assignNodeIds(babelAst, snapshot);
    const finalized = finalizeDiagnostics(
      [
        ...babelAst.errors.map((error: unknown) =>
          diagnosticFromBabel(error, snapshot),
        ),
        ...assigned.diagnostics,
        ...validate(assigned.nodes, assigned.parents, snapshot),
      ],
      snapshot,
    );

    return {
      ast: babelAst,
      snapshot,
      nodes: assigned.nodes,
      nodeIds: assigned.nodeIds,
      parents: assigned.parents,
      invalidNodes: assigned.invalidNodes,
      diagnostics: finalized.diagnostics,
      diagnosticsTruncated: finalized.diagnosticsTruncated,
      complete:
        finalized.diagnostics.length === 0 && !finalized.diagnosticsTruncated,
    };
  } catch (e) {
    const finalized = finalizeDiagnostics(
      [diagnosticFromBabel(e, snapshot)],
      snapshot,
    );
    return {
      ast: null,
      snapshot,
      complete: false,
      diagnosticsTruncated: finalized.diagnosticsTruncated,
      ...assignNodeIds(null, snapshot),
      diagnostics: finalized.diagnostics,
    };
  }
}
