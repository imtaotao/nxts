// 123n 需要任意精度整数的表示、运算和 ABI。
// 当前数值模型按固定宽度走，不能借 JS BigInt 混进来。
// no: const n = 123n

import type { Rule } from '../../types';
import { rejectNode } from '../rejectNode';

export const bigintLiteralRule: Rule = {
  name: 'bigintLiteral',
  check: (node, ctx) => {
    if (node.type === 'BigIntLiteral') {
      return rejectNode(node, ctx, 'parser.bigintLiteral');
    }
    return null;
  },
};
