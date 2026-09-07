import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import { atomKindOfKeyword } from '../../link/builtin';

// 关键字原子
// `string`
// `number`
// `boolean`
// `void`
// `never`
export function resolveKeyword(hang: Hang, type: Node) {
  const keyword = atomKindOfKeyword(type.type);
  return isNil(keyword) ? null : hang.context.table.atom(keyword);
}
