import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import { atomKindOfKeyword } from '../../link/builtin';

export function resolveKeyword(hang: Hang, type: Node) {
  const keyword = atomKindOfKeyword(type.type);
  return isNil(keyword) ? null : hang.context.table.atom(keyword);
}
