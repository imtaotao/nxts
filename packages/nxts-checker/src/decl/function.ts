import type { Identifier, Node } from '@babel/types';
import { unwrapType } from '../hang/ast';
import { functionTypeOf } from '../hang/resolve/function';
import type { Hang } from '../hang';

const hangFunctionLike = (
  hang: Hang,
  node: Node & { params: readonly Node[]; returnType?: Node | null },
  name?: Identifier | null,
) => {
  for (const param of node.params) {
    hang.hangPattern(param);
  }
  if (node.returnType != null) {
    const returnType = hang.resolveAtomType(node.returnType);
    if (returnType != null) {
      hang.hangNode(unwrapType(node.returnType), returnType);
    }
  }
  const fnType = functionTypeOf(hang, node.params, node.returnType);
  if (fnType == null) {
    return;
  }
  hang.hangNode(node, fnType);
  if (name == null) {
    return;
  }
  const symbolId = hang.symbolIn(name, 'value');
  if (symbolId != null) {
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
