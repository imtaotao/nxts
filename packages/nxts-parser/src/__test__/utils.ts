import { assignNodeIds } from "../assignNodeIds";
import { babelParse } from "../babelParse";
import { parseFile } from "../index";
import { createSnapshot } from "../snapshot";
import { validate } from "../validator/index";

export function snapshotFromText(
  code: string,
  options?: {
    canonicalPath?: string;
    fileId?: number;
    sourceVersion?: number;
  },
) {
  return createSnapshot({
    utf8: new TextEncoder().encode(code),
    canonicalPath: options?.canonicalPath ?? "test.ts",
    fileId: options?.fileId,
    sourceVersion: options?.sourceVersion,
  });
}

export function messageIds(code: string) {
  const ast = babelParse(code, "test.ts");
  const { nodes, parents } = assignNodeIds(ast);
  return validate(nodes, parents).map((diagnostic) => diagnostic.messageId);
}

export function parseMessageIds(code: string) {
  return parseFile(snapshotFromText(code)).diagnostics.map(
    (diagnostic) => diagnostic.messageId,
  );
}
