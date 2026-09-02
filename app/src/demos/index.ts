import type { PlaygroundFile } from '../lib/index.ts';
import { source as count } from './default/count.ts';
import { source as flow } from './default/flow.ts';
import { source as kind } from './default/kind.ts';
import { source as main } from './default/main.ts';
import { source as seed } from './default/seed.ts';
import { source as types } from './default/types.ts';

export const defaultFiles: PlaygroundFile[] = [
  { path: 'main.ts', source: main },
  { path: 'types.ts', source: types },
  { path: 'flow.ts', source: flow },
  { path: 'kind.ts', source: kind },
  { path: 'seed.ts', source: seed },
  { path: 'count.ts', source: count },
];
