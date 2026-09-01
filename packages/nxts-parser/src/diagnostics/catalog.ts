import type { Diagnostic, SourceSpan } from "../types";

export const messageCodes = {
  "parser.babel": "NXT1000",
  "parser.unsupported": "NXT1001",
  "parser.any": "NXT1003",
  "parser.budget.error": "NXT0901",
  "parser.ast.unknownNode": "NXT1010",
  "parser.ast.missingSpan": "NXT1011",
  "parser.ast.invalidSpan": "NXT1012",
  "parser.ast.parentSpan": "NXT1013",
  "parser.var": "NXT1101",
  "parser.eqeq": "NXT1102",
  "parser.bigintLiteral": "NXT1104",
  "parser.bigintKeyword": "NXT1105",
  "parser.objectKeyword": "NXT1106",
  "parser.nonNullAssertion": "NXT1107",
  "parser.typeAssertion": "NXT1108",
  "parser.taggedTemplate": "NXT1109",
  "parser.privateName": "NXT1110",
  "parser.importEquals": "NXT1111",
  "parser.classAccessor": "NXT1112",
  "parser.using": "NXT1113",
  "parser.override": "NXT1114",
  "parser.abstract": "NXT1115",
  "parser.declare": "NXT1116",
  "parser.namespace": "NXT1117",
  "parser.bitwise": "NXT1118",
  "parser.objectLiteralAccessor": "NXT1119",
  "parser.arrayHole": "NXT1120",
  "parser.definiteAssignment": "NXT1121",
  "parser.newTarget": "NXT1201",
  "parser.accessorTypeParams": "NXT1202",
  "parser.asConst": "NXT1203",
  "parser.optionalOrder": "NXT1204",
  "parser.constTypeParam": "NXT1205",
  "parser.overloadDeclare": "NXT1206",
  "parser.classOverload": "NXT1207",
  "parser.tupleRest": "NXT1208",
} as const;

export type MessageId = keyof typeof messageCodes;

export function createDiagnostic(
  messageId: MessageId,
  primarySpan: SourceSpan,
  args: readonly unknown[] = [],
) {
  return {
    messageId,
    primarySpan,
    arguments: args,
    phase: "parser",
    severity: "error",
    code: messageCodes[messageId],
  } satisfies Diagnostic;
}
