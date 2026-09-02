// x! 告诉类型检查器“后面会赋值”，运行时槽位仍可能未写。
// 类字段要有初始化或构造器确定赋值，不能靠 ! 跳过。
// no: class A { x!: number }

import type { Rule } from '../../types';
import { rejectNode } from '../rejectNode';

export const definiteAssignmentRule: Rule = {
  name: 'definiteAssignment',
  check: (node, ctx) => {
    if (
      (node.type === 'ClassProperty' ||
        node.type === 'ClassPrivateProperty' ||
        node.type === 'ClassAccessorProperty') &&
      node.definite === true
    ) {
      return rejectNode(node, ctx, 'parser.definiteAssignment');
    }
    return null;
  },
};
