// namespace / global 会合并声明空间，同一名字可拆到多个文件。
// Nxts 要闭合类型和 ABI，没有这套合并模型，也没有 ambient 全局。
// no: namespace A {}
// no: declare global {}

import type { Rule } from '../../types';
import { rejectNode } from '../rejectNode';

export const namespaceRule: Rule = {
  name: 'namespace',
  check: (node, ctx) => {
    if (node.type === 'TSModuleDeclaration') {
      return rejectNode(node, ctx, 'parser.namespace');
    }
    return null;
  },
};
