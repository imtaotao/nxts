import { isObject } from "aidly";
import { createDiagnostic } from "./catalog";
import type { SourceSnapshot } from "../snapshot";

type BabelErrorLike = {
  message?: string;
  reasonCode?: string;
  loc?: { index?: number };
  details?: { missingPlugin?: string[] };
};

const asBabelError = (value: unknown) => {
  if (isObject(value)) {
    return value as BabelErrorLike;
  }
  return { message: String(value) } as BabelErrorLike;
};

// 把 Babel 错误转换为 Nxts 诊断
export function diagnosticFromBabel(error: unknown, snapshot: SourceSnapshot) {
  const e = asBabelError(error);
  const primarySpan = {
    start: e.loc?.index ?? 0,
    end: e.loc?.index ?? 0,
    fileId: snapshot.fileId,
    sourceVersion: snapshot.sourceVersion,
  };
  if (e.reasonCode === "MissingPlugin") {
    return createDiagnostic(
      "parser.unsupported",
      primarySpan,
      e.details?.missingPlugin ?? [],
    );
  }
  return createDiagnostic("parser.babel", primarySpan, [
    e.message ?? String(error),
  ]);
}
