import { describe, expect, it } from 'vitest';
import { CheckContext } from '../context';
import { internAtom } from '../core/intern';
import { equal } from '../core/relation';

describe('internAtom', () => {
  it('reuses TypeId for the same atom', () => {
    const context = new CheckContext();
    const first = internAtom(context, 'i32');
    const second = internAtom(context, 'i32');
    expect(first).toBe(0);
    expect(second).toBe(first);
    expect(context.types).toHaveLength(1);
  });

  it('gives i32 and f64 different TypeIds', () => {
    const context = new CheckContext();
    const i32 = internAtom(context, 'i32');
    const f64 = internAtom(context, 'f64');
    expect(equal(i32, f64)).toBe(false);
    expect(equal(i32, internAtom(context, 'i32'))).toBe(true);
    expect(context.types[i32]?.kind).toBe('i32');
    expect(context.types[f64]?.kind).toBe('f64');
  });
});
