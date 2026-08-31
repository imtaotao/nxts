import { assignNodeIds } from "../assignNodeIds";
import { babelParse } from "../babelParse";
import { parseFile } from "../index";
import { validate } from "../validator/index";

export function messageIds(code: string) {
  const ast = babelParse(code, "test.ts");
  const { nodes, parents } = assignNodeIds(ast);
  return validate(nodes, parents).map((diagnostic) => diagnostic.messageId);
}

export function parseMessageIds(code: string) {
  return parseFile(code, "test.ts").diagnostics.map(
    (diagnostic) => diagnostic.messageId,
  );
}
