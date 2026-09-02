// accessor 字段会生成成对 get/set 和隐藏 backing 槽。
// 未开 decoratorAutoAccessors，源码通常先被 Babel 挡住；节点若出现仍拒。
// no: class A { accessor x = 1 }

import type { Rule } from '../../types';
import { rejectNode } from '../rejectNode';

export const classAccessorRule: Rule = {
  name: 'classAccessor',
  check: (node, ctx) => {
    if (node.type === 'ClassAccessorProperty') {
      return rejectNode(node, ctx, 'parser.classAccessor');
    }
    return null;
  },
};
