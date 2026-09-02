import { unindent } from 'aidly';

export const source = unindent`
  export enum Kind {
    Ready,
    Busy = Ready,
  }

  export const kind: Kind = Kind.Ready;
`;
