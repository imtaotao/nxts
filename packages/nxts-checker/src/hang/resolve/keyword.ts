import type { Node } from '@babel/types';
import { atomKindOfKeyword } from '../../link/builtin';
import type { Hang } from '../index';

export function resolveKeyword(hang: Hang, type: Node) {
  const keyword = atomKindOfKeyword(type.type);
  return keyword == null ? null : hang.context.table.atom(keyword);
}
