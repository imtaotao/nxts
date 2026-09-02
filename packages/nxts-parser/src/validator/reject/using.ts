// using 需要 Symbol.dispose、作用域退出和失败顺序。
// 这套资源协议还没定，不能先按 JS 语义落地。
// no: using x = foo()
// no: await using x = foo()

import type { Rule } from '../../types';
import { rejectNode } from '../rejectNode';

export const usingRule: Rule = {
  name: 'using',
  check: (node, ctx) => {
    if (node.type === 'VariableDeclaration') {
      if (node.kind === 'using' || node.kind === 'await using') {
        return rejectNode(node, ctx, 'parser.using');
      }
    }
    if (node.type === 'VoidPattern') {
      return rejectNode(node, ctx, 'parser.using');
    }
    return null;
  },
};
