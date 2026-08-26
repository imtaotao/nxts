import { describe, expect, it } from "vitest";
import { parseFile } from "../index";

describe("parseFile", () => {
  it("accepts a legal module", () => {
    const result = parseFile("const x = 1 === 2;\n", "test.ts");
    expect(result.complete).toBe(true);
    expect(result.ast).not.toBeNull();
    expect(result.diagnostics).toEqual([]);
  });
});
