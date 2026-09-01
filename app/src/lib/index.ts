import { createSnapshot, parseFile } from "@nxts/parser";

export async function run(source: string) {
  return parseFile(
    await createSnapshot({
      utf8: new TextEncoder().encode(source),
      canonicalPath: "test.ts",
    }),
  );
}
