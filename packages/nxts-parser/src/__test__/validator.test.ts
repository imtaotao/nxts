import { describe, expect, it } from "vitest";
import { babelParse } from "../babelParse";
import { assignNodeIds } from "../assignNodeIds";
import { validate } from "../validator/index";

const messageIds = (code: string) => {
  const ast = babelParse(code, "test.ts");
  const { nodes } = assignNodeIds(ast);
  return validate(nodes).map((diagnostic) => diagnostic.messageId);
};

describe("validate", () => {
  it("rejects var", () => {
    expect(messageIds("var a = 1;\n")).toContain("parser.var");
  });

  it("rejects == and !=", () => {
    expect(messageIds("const x = 1 == 2;\n")).toContain("parser.eqeq");
    expect(messageIds("const x = 1 != 2;\n")).toContain("parser.eqeq");
  });

  it("rejects any", () => {
    expect(messageIds("const x: any = 1;\n")).toContain("parser.any");
  });

  it("rejects bigint literals", () => {
    expect(messageIds("const n = 123n;\n")).toContain("parser.bigintLiteral");
  });
});
