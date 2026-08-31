import { parseFile } from "@nxts/parser";

const code = `
  const n: bigint = 1 as never;
`;

export function run() {
  return parseFile(code, "test.ts");
}
