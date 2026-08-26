import { parseFile } from "@nxts/parser";

const code = `
  const x = 1;
  const y = 2;
  const z = x + y;
  console.log(z);
  var a = 1;
`;

export function run() {
  return parseFile(code, "test.ts");
}
