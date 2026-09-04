import { isNil } from 'aidly';
import type { Identifier, Node } from '@babel/types';
import type { Hang } from '../hang';
import { unwrapType } from '../hang/ast';
import { functionTypeOf } from '../hang/resolve/function';

const hangFunctionLike = (
  hang: Hang,
  node: Node & { params: readonly Node[]; returnType?: Node | null },
  name?: Identifier | null,
) => {
  for (const param of node.params) {
    hang.hangPattern(param);
  }
  if (!isNil(node.returnType)) {
    const returnType = hang.resolveAtomType(node.returnType);
    if (!isNil(returnType)) {
      hang.hangNode(unwrapType(node.returnType), returnType);
    }
  }
  const fnType = functionTypeOf(hang, node.params, node.returnType);
  if (isNil(fnType)) {
    return;
  }
  hang.hangNode(node, fnType);
  if (isNil(name)) {
    return;
  }
  const symbolId = hang.symbolIn(name, 'value');
  if (!isNil(symbolId)) {
    hang.symbolTypes[symbolId] = fnType;
  }
  hang.hangNode(name, fnType);
};

export function checkFunctions(hang: Hang) {
  for (const node of hang.file.nodes) {
    switch (node.type) {
      case 'FunctionDeclaration':
        hangFunctionLike(hang, node, node.id);
        continue;
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ObjectMethod':
      case 'ClassMethod':
      case 'ClassPrivateMethod':
        hangFunctionLike(hang, node);
        continue;
      default:
        continue;
    }
  }
}
