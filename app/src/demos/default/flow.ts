import { unindent } from 'aidly';

export const source = unindent`
  import { n } from './seed';
  import type { Count } from './count';
  import type { Array } from './types';

  export function f(items: Array<Count>): Count {
    const add = (a: Count) => a + n;
    const { head } = { head: n };

    switch (n) {
      case 1:
        let m: Count = add(head);
        return m;
      default:
        break;
    }

    try {
      throw n;
    } catch (e) {
      loop: for (const item of items) {
        if (item === n) {
          break loop;
        }
      }
      return e;
    }
  }

  export function usedBeforeDecl(): Count {
    return later();
    function later(): Count {
      return n;
    }
  }
`;
