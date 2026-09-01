import { describe, expect, it } from "vitest";
import { createSnapshot, parseFile } from "../index";
import { snapshotFromText } from "./utils";

const utf8 = (text: string) => new TextEncoder().encode(text);

const utf8WithBom = (text: string) => {
  const body = utf8(text);
  const bytes = new Uint8Array(3 + body.length);
  bytes.set([0xef, 0xbb, 0xbf]);
  bytes.set(body, 3);
  return bytes;
};

describe("parseFile", () => {
  it("accepts a legal module", () => {
    const snapshot = snapshotFromText("const x = 1 === 2;\n");
    const result = parseFile(snapshot);
    expect(result.complete).toBe(true);
    expect(result.ast).not.toBeNull();
    expect(result.snapshot).toBe(snapshot);
    expect(result.diagnostics).toEqual([]);
  });

  it("attaches snapshot identity to validator diagnostics", () => {
    const snapshot = snapshotFromText("var x = 1;\n", {
      canonicalPath: "src/a.ts",
      fileId: 3,
      sourceVersion: 2,
    });
    const result = parseFile(snapshot);
    expect(result.complete).toBe(false);
    expect(result.snapshot).toBe(snapshot);
    expect(result.diagnostics[0]?.messageId).toBe("parser.var");
    expect(result.diagnostics[0]?.primarySpan).toMatchObject({
      fileId: 3,
      sourceVersion: 2,
    });
  });

  it("attaches snapshot identity and babel loc to parser diagnostics", () => {
    const snapshot = snapshotFromText("  with (obj) {}", {
      canonicalPath: "src/a.ts",
      fileId: 4,
      sourceVersion: 5,
    });
    const result = parseFile(snapshot);
    expect(result.diagnostics[0]?.messageId).toBe("parser.babel");
    expect(result.diagnostics[0]?.primarySpan).toEqual({
      start: 2,
      end: 2,
      fileId: 4,
      sourceVersion: 5,
    });
  });

  it("parses bom-prefixed bytes from the stripped text", () => {
    const source = "  with (obj) {}";
    const snapshot = createSnapshot({
      utf8: utf8WithBom(source),
      canonicalPath: "src/a.ts",
    });
    const result = parseFile(snapshot);
    expect(snapshot.hadBom).toBe(true);
    expect(snapshot.text).toBe(source);
    expect(result.diagnostics[0]?.messageId).toBe("parser.babel");
    expect(result.diagnostics[0]?.primarySpan.start).toBe(2);
  });

  it("passes displayPath to babel as the ast filename", () => {
    const snapshot = createSnapshot({
      utf8: utf8("const x = 1;\n"),
      canonicalPath: "src/a.ts",
      displayPath: "a.ts",
    });
    const result = parseFile(snapshot);
    expect(result.complete).toBe(true);
    expect(result.ast?.loc?.filename).toBe("a.ts");
  });
});
