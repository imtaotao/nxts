// 无函数体的签名不是独立函数，只是相邻重载组的候选。
// 必须紧挨同名、同导出、同类实现；中间插声明或只写签名，组就闭合不了。
// 显式 declare 由 declare 规则处理；类方法交给 classOverload。
// ok: function f(a: number): void; function f(a: string): void; function f(a: number | string) {}
// no: function f(a: number): void;
// no: function f(a: number): void; const x = 1; function f(a: number) {}

import { isArray, isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Rule, RuleContext } from '../../types';
import { rejectNode } from '../rejectNode';

const unwrapExport = (stmt: Node) => {
  if (
    stmt.type === 'ExportNamedDeclaration' ||
    stmt.type === 'ExportDefaultDeclaration'
  ) {
    return { wrap: stmt.type, fn: stmt.declaration };
  }
  return { wrap: null, fn: stmt };
};

const readMember = (stmt: Node) => {
  const { wrap, fn } = unwrapExport(stmt);
  if (
    isNil(fn) ||
    (fn.type !== 'TSDeclareFunction' && fn.type !== 'FunctionDeclaration') ||
    fn.declare === true
  ) {
    return null;
  }
  return {
    wrap,
    name: fn.id ? fn.id.name : null,
    async: fn.async === true,
    generator: fn.generator === true,
    impl: fn.type === 'FunctionDeclaration',
  };
};

const sameGroup = (
  left: NonNullable<ReturnType<typeof readMember>>,
  right: NonNullable<ReturnType<typeof readMember>>,
) =>
  left.wrap === right.wrap &&
  left.name === right.name &&
  left.async === right.async &&
  left.generator === right.generator;

const statementList = (node: Node, ctx: RuleContext) => {
  let stmt: Node = node;
  let parent = ctx.parent;
  if (
    parent?.type === 'ExportNamedDeclaration' ||
    parent?.type === 'ExportDefaultDeclaration'
  ) {
    stmt = parent;
    parent = ctx.parents.get(parent) ?? null;
  }
  if (isNil(parent) || parent.type === 'ClassBody' || !('body' in parent)) {
    return null;
  }
  const body = parent.body;
  if (!isArray(body)) {
    return null;
  }
  return { stmt, body: body as Node[] };
};

export const overloadDeclareRule: Rule = {
  name: 'overloadDeclare',
  check: (node, ctx) => {
    if (node.type !== 'TSDeclareFunction' || node.declare === true) {
      return null;
    }
    const list = statementList(node, ctx);
    if (isNil(list)) {
      return rejectNode(node, ctx, 'parser.overloadDeclare');
    }
    const current = readMember(list.stmt);
    if (isNil(current)) {
      return rejectNode(node, ctx, 'parser.overloadDeclare');
    }
    const index = list.body.indexOf(list.stmt);
    if (index < 0) {
      return rejectNode(node, ctx, 'parser.overloadDeclare');
    }
    for (let i = index + 1; i < list.body.length; i++) {
      const next = readMember(list.body[i]);
      if (isNil(next) || !sameGroup(current, next)) {
        return rejectNode(node, ctx, 'parser.overloadDeclare');
      }
      if (next.impl) {
        return null;
      }
    }
    return rejectNode(node, ctx, 'parser.overloadDeclare');
  },
};
