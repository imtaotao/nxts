import { unindent } from 'aidly';

export const source = unindent`
  import { n } from './seed';
  import { Array, empty } from './types';
  import type { Unwrapped } from './types';
  import { f } from './flow';
  import { Kind, kind } from './kind';

  export { n, empty, f, kind, Kind };

  export const Ctor = Array;
  export const sample: Unwrapped = n;
  export const first = f(empty);
`;
