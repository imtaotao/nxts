import { unindent } from 'aidly';

export const source = unindent`
  import { seed } from './seed';
  import type { Count } from './count';

  export type OptionalCount = Partial<{ n: Count }>;
  export type Later = Promise<Count>;
  export type Unwrap<T> = T extends Promise<infer U> ? U : T;
  export type Unwrapped = Unwrap<Later>;

  export type Array<T> = T;
  export const Array = seed;
  export const empty: Array<Count> = [];
`;
