import { parse } from "@babel/parser";

export function parseFile(code: string, sourceFilename: string) {
  return parse(code, {
    sourceType: "module",
    errorRecovery: true,
    sourceFilename,
    plugins: ["typescript"],
  });
}
