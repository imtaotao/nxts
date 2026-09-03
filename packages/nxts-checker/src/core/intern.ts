import type { CheckContext } from '../context';
import type { AtomKind } from '../types';

export function internAtom(context: CheckContext, kind: AtomKind) {
  return context.intern(`atom:${kind}`, kind);
}
