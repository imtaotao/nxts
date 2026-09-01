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

export async function messageIds(code: string) {
  const snapshot = await snapshotFromText(code);
  const ast = babelParse(code, snapshot.displayPath);
  const { nodes, parents } = assignNodeIds(ast, snapshot);
  return validate(nodes, parents, snapshot).map(
    (diagnostic) => diagnostic.messageId,
  );
}

export async function parseMessageIds(code: string) {
  return parseFile(await snapshotFromText(code)).diagnostics.map(
    (diagnostic) => diagnostic.messageId,
  );
}
