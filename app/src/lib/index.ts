import { createSnapshot, parseFile } from "@nxts/parser";

const code = `
  const n: bigint = 1 as never;
`;

export function run() {
  return parseFile(
    createSnapshot({
      utf8: new TextEncoder().encode(code),
      canonicalPath: "test.ts",
    }),
  );
}
