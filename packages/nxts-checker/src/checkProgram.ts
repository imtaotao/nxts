import type { BindFileResult, BindProgramResult } from '@nxts/binder';
import type { CheckFileResult, CheckProgramResult } from './types';

const emptyFile = (file: BindFileResult) => {
  const nodeCount = file.nodeToSymbols.length;
  return {
    symbolTypes: file.symbols.map(() => null),
    nodeTypes: Array.from({ length: nodeCount }, () => null),
    nodeReachable: Array.from({ length: nodeCount }, () => true),
    nodeConstants: Array.from({ length: nodeCount }, () => null),
    diagnostics: [],
    complete: false,
  } satisfies CheckFileResult;
};

export function checkProgram(program: BindProgramResult) {
  return {
    types: [],
    files: program.files.map(emptyFile),
    diagnostics: [],
    diagnosticsTruncated: false,
    complete: false,
  } satisfies CheckProgramResult;
}
