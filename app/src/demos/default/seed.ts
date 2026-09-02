import { unindent } from 'aidly';

export const source = unindent`
  import type { Count } from './count';

  export const seed = 1;
  export const n: Count = seed;
`;
