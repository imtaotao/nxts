import { unindent } from 'aidly';

export const source = unindent`
  import type { Count as SharedCount } from './count';

  export type Count = number;
  export type Width = i32;
  export type Alias = Width;

  export const fromCount: SharedCount = 1;

  export const n: Count = 1;
  export let w: Width = 2;
  export const k: i32 = 3;

  export function add(a: i32, b: i32): i32 {
    return a;
  }

  export const twice = (x: number): number => x;

  export const { head } = { head: n };

  export enum Tone {
    Low,
    High,
  }

  export const tone: Tone = Tone.Low;

  export class Box {}

  export const box: Box = new Box();

  export interface Named {
    title: string;
  }

  export const named: Named = { title: 'a' };

  export function id<T>(value: T): T {
    return value;
  }

  export type Cell<T> = T;
  export const cell: Cell<Count> = 1;
  export const list: Array<i32> = [];

  export type Point = { x: number; y: number };
  export const point: Point = { x: 1, y: 2 };
  export type TextOrCount = string | Count;
  export const either: TextOrCount = 'a';

  export type Counted = { n: number };
  export type NamedCount = Named & Counted;
  export const row: NamedCount = { title: 'a', n: 1 };

  export type Pair = [i32, string];
  export const pair: Pair = [1, 'a'];

  export type Binary = (left: i32, right: i32) => i32;
  export const binary: Binary = add;

  export type Status = 200 | 404;
  export type Frozen = readonly i32[];
`;
