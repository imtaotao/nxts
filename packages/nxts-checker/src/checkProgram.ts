import type { BindFileResult, BindProgramResult } from '@nxts/binder';
import { CheckContext } from './context';
import { checkVariables } from './decl/variable';
import type { CheckFileResult, CheckProgramResult } from './types';

const checkFile = (context: CheckContext, file: BindFileResult) => {
  const nodeCount = file.nodeToSymbols.length;
  const symbolTypes = file.symbols.map(() => null);
  const nodeTypes = Array.from({ length: nodeCount }, () => null);
  checkVariables(context, file, symbolTypes, nodeTypes);
  return {
    symbolTypes,
    nodeTypes,
    nodeReachable: Array.from({ length: nodeCount }, () => true),
    nodeConstants: Array.from({ length: nodeCount }, () => null),
    diagnostics: [],
    complete: false,
  } satisfies CheckFileResult;
};

export function checkProgram(program: BindProgramResult) {
  const context = new CheckContext();
  return {
    types: context.table.types,
    files: program.files.map((file) => checkFile(context, file)),
    diagnostics: [],
    diagnosticsTruncated: false,
    complete: false,
  } satisfies CheckProgramResult;
}
