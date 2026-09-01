import { isArray } from "aidly";
import { VISITOR_KEYS, isNode, type Node } from "@babel/types";
import { createDiagnostic, type MessageId } from "./diagnostics/catalog";
import type { SourceSnapshot } from "./snapshot";
import type { Diagnostic } from "./types";

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const readSpan = (node: Node) => {
  if (!isFiniteNumber(node.start) || !isFiniteNumber(node.end)) {
    return null;
  }
  return { start: node.start, end: node.end };
};

const spanMessageId = (
  node: Node,
  parent: Node | null,
  textLength: number,
): MessageId | null => {
  const span = readSpan(node);
  if (!span) {
    return "parser.ast.missingSpan";
  }
  if (span.start < 0 || span.end > textLength || span.start > span.end) {
    return "parser.ast.invalidSpan";
  }
  if (node.range != null) {
    if (
      !isArray(node.range) ||
      node.range.length !== 2 ||
      node.range[0] !== span.start ||
      node.range[1] !== span.end
    ) {
      return "parser.ast.invalidSpan";
    }
  }
  if (parent) {
    const parentSpan = readSpan(parent);
    if (
      parentSpan &&
      (span.start < parentSpan.start || span.end > parentSpan.end)
    ) {
      return "parser.ast.parentSpan";
    }
  }
  return null;
};

export function assignNodeIds(root: Node | null, snapshot: SourceSnapshot) {
  const nodes: Node[] = [];
  const nodeIds = new WeakMap<Node, number>();
  const parents = new WeakMap<Node, Node>();
  const invalidNodes = new Set<Node>();
  const seen = new WeakSet<Node>();
  const diagnostics: Diagnostic[] = [];

  const contractDiagnostic = (
    node: Node,
    messageId: MessageId,
    useNodeSpan: boolean,
  ) => {
    const span = useNodeSpan ? readSpan(node) : null;
    return createDiagnostic(messageId, {
      fileId: snapshot.fileId,
      sourceVersion: snapshot.sourceVersion,
      start: span?.start ?? 0,
      end: span?.end ?? 0,
    });
  };

  const walkChildren = (node: Node) => {
    const keys = VISITOR_KEYS[node.type];
    if (keys == null) {
      return;
    }
    for (const key of keys) {
      const child = node[key as keyof Node];
      if (isArray(child)) {
        for (const item of child) {
          if (isNode(item)) {
            visit(item, node);
          }
        }
      } else if (isNode(child)) {
        visit(child, node);
      }
    }
  };

  const visit = (node: Node, parent: Node | null) => {
    if (seen.has(node)) {
      return;
    }
    seen.add(node);

    if (VISITOR_KEYS[node.type] == null) {
      invalidNodes.add(node);
      diagnostics.push(
        contractDiagnostic(node, "parser.ast.unknownNode", false),
      );
      return;
    }

    const messageId = spanMessageId(node, parent, snapshot.text.length);
    if (messageId) {
      invalidNodes.add(node);
      diagnostics.push(
        contractDiagnostic(
          node,
          messageId,
          messageId === "parser.ast.parentSpan",
        ),
      );
    } else {
      nodeIds.set(node, nodes.length);
      nodes.push(node);
      if (parent) {
        parents.set(node, parent);
      }
    }

    walkChildren(node);
  };

  if (root) {
    visit(root, null);
  }

  return { nodes, nodeIds, parents, invalidNodes, diagnostics };
}
