// 类型 bigint 同样要求任意精度整数布局。
// 和字面量 123n 一起拒，避免只挡值、放行类型。
// no: const n: bigint = 1

import type { Rule } from '../../types';
import { rejectNode } from '../rejectNode';

export const bigintKeywordRule: Rule = {
  name: 'bigintKeyword',
  check: (node, ctx) => {
    if (node.type === 'TSBigIntKeyword') {
      return rejectNode(node, ctx, 'parser.bigintKeyword');
    }
    return null;
  },
};
