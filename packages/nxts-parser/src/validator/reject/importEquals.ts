// import = require / export = 是 CommonJS 互操作。
// Nxts 模块只有静态 ESM，没有 CJS 导出形状和加载协议。
// no: import fs = require("fs")
// no: export = fs

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const importEqualsRule: Rule = {
  name: "importEquals",
  check: (node) => {
    if (
      node.type === "TSImportEqualsDeclaration" ||
      node.type === "TSExportAssignment"
    ) {
      return rejectNode(node, "NXT1001", "parser.importEquals");
    }
    return null;
  },
};
