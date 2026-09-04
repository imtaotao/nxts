import type { BindProgramResult } from '@nxts/binder';
import { CheckContext } from './context';
import { checkAliases } from './decl/alias';
import { checkClasses } from './decl/class';
import { checkEnums } from './decl/enum';
import { checkFunctions } from './decl/function';
import { checkGenerics } from './decl/generic';
import { Hang } from './hang';
import { checkInterfaces } from './decl/interface';
import { checkVariables } from './decl/variable';
import { checkImports } from './link/import';
import type { CheckFileResult, CheckProgramResult } from './types';

const filledCount = (hangs: readonly Hang[]) => {
  let count = 0;
  for (const hang of hangs) {
    for (const id of hang.symbolTypes) {
      if (id != null) {
        count += 1;
      }
    }
  }
  return count;
};

const hangTypes = (program: BindProgramResult, hangs: Hang[]) => {
  let before = -1;
  let after = 0;
  while (after > before) {
    before = after;
    for (const hang of hangs) {
      checkGenerics(hang);
      checkAliases(hang);
      checkEnums(hang);
      checkClasses(hang);
      checkInterfaces(hang);
    }
    checkImports(program, hangs);
    after = filledCount(hangs);
  }
};

const hangValues = (program: BindProgramResult, hangs: Hang[]) => {
  for (const hang of hangs) {
    checkVariables(hang);
    checkFunctions(hang);
  }
  checkImports(program, hangs);
};

const finishFile = (hang: Hang) => {
  const nodeCount = hang.file.nodeToSymbols.length;
  return {
    symbolTypes: hang.symbolTypes,
    nodeTypes: hang.nodeTypes,
    nodeReachable: Array.from({ length: nodeCount }, () => true),
    nodeConstants: Array.from({ length: nodeCount }, () => null),
    diagnostics: [],
    complete: false,
  } satisfies CheckFileResult;
};

export function checkProgram(program: BindProgramResult) {
  const context = new CheckContext();
  const hangs = program.files.map((file) => new Hang(context, file));
  context.program = program;
  context.hangs = hangs;
  hangTypes(program, hangs);
  hangValues(program, hangs);

  return {
    types: context.table.types,
    files: hangs.map(finishFile),
    diagnostics: [],
    diagnosticsTruncated: false,
    complete: false,
  } satisfies CheckProgramResult;
}
