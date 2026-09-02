import type {
  BlockStatement,
  BreakStatement,
  ClassDeclaration,
  ContinueStatement,
  DoWhileStatement,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  ImportDeclaration,
  LabeledStatement,
  ModuleDeclaration,
  ReturnStatement,
  Statement,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
  TSEnumDeclaration,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  VariableDeclaration,
  WhileStatement,
} from '@babel/types';
import type { BinderContext } from '../context';
import { declareClass } from '../declare/class';
import { declareEnum } from '../declare/enum';
import { declareFunction } from '../declare/function';
import {
  bindExportDefault,
  bindExportNamed,
  bindLocalExportSpecifiers,
  declarationOf,
  declareImport,
  hoistImports,
} from '../declare/module';
import { declarePattern } from '../declare/pattern';
import { declareInterface, declareTypeAlias } from '../declare/type';
import { declareVariable } from '../declare/variable';
import { resolveExpr } from './resolveExpr';

const bindForBinding = (
  binder: BinderContext,
  declaration: VariableDeclaration | null,
  rest: () => void,
) => {
  if (declaration) {
    binder.openScope('block');
    declareVariable(binder, declaration);
  }
  rest();
  if (declaration) {
    binder.closeScope();
  }
};

const bindForInOf = (
  binder: BinderContext,
  statement: ForOfStatement | ForInStatement,
) => {
  const declaration =
    statement.left.type === 'VariableDeclaration' ? statement.left : null;

  bindForBinding(binder, declaration, () => {
    if (statement.left.type !== 'VariableDeclaration') {
      resolveExpr(binder, statement.left);
    }
    resolveExpr(binder, statement.right);
    bindStatement(binder, statement.body);
  });
};

const skipHoist = (
  binder: BinderContext,
  statement: Statement | ModuleDeclaration,
) => {
  if (binder.isInvalid(statement)) {
    return true;
  }
  const target = declarationOf(statement);
  return target != null && binder.isInvalid(target);
};

const hoistFunctions = (
  binder: BinderContext,
  statements: Array<Statement | ModuleDeclaration>,
) => {
  for (const statement of statements) {
    if (skipHoist(binder, statement)) {
      continue;
    }
    const target = declarationOf(statement);
    if (target?.type === 'FunctionDeclaration' && target.id) {
      binder.declare('value', target.id);
    }
  }
};

const hoistTypes = (
  binder: BinderContext,
  statements: Array<Statement | ModuleDeclaration>,
) => {
  for (const statement of statements) {
    if (skipHoist(binder, statement)) {
      continue;
    }
    const target = declarationOf(statement);
    if (
      target &&
      (target.type === 'TSTypeAliasDeclaration' ||
        target.type === 'TSInterfaceDeclaration' ||
        target.type === 'TSEnumDeclaration') &&
      target.id
    ) {
      binder.declare('type', target.id);
    }
  }
};

const hoistClasses = (
  binder: BinderContext,
  statements: Array<Statement | ModuleDeclaration>,
) => {
  for (const statement of statements) {
    if (skipHoist(binder, statement)) {
      continue;
    }
    const target = declarationOf(statement);
    if (target?.type === 'ClassDeclaration' && target.id) {
      binder.declare('value', target.id);
      binder.declare('type', target.id);
    }
  }
};

const binders = {
  VariableDeclaration: (
    binder: BinderContext,
    statement: VariableDeclaration,
  ) => {
    declareVariable(binder, statement);
  },

  FunctionDeclaration: (
    binder: BinderContext,
    statement: FunctionDeclaration,
  ) => {
    declareFunction(binder, statement);
  },

  ClassDeclaration: (binder: BinderContext, statement: ClassDeclaration) => {
    declareClass(binder, statement);
  },

  ExpressionStatement: (
    binder: BinderContext,
    statement: ExpressionStatement,
  ) => {
    resolveExpr(binder, statement.expression);
  },

  ReturnStatement: (binder: BinderContext, statement: ReturnStatement) => {
    if (statement.argument) {
      resolveExpr(binder, statement.argument);
    }
  },

  BlockStatement: (binder: BinderContext, statement: BlockStatement) => {
    binder.openScope('block');
    bindStatementList(binder, statement.body);
    binder.closeScope();
  },

  IfStatement: (binder: BinderContext, statement: IfStatement) => {
    resolveExpr(binder, statement.test);
    bindStatement(binder, statement.consequent);
    if (statement.alternate) {
      bindStatement(binder, statement.alternate);
    }
  },

  WhileStatement: (binder: BinderContext, statement: WhileStatement) => {
    resolveExpr(binder, statement.test);
    bindStatement(binder, statement.body);
  },

  DoWhileStatement: (binder: BinderContext, statement: DoWhileStatement) => {
    bindStatement(binder, statement.body);
    resolveExpr(binder, statement.test);
  },

  ForStatement: (binder: BinderContext, statement: ForStatement) => {
    const declaration =
      statement.init?.type === 'VariableDeclaration' ? statement.init : null;

    bindForBinding(binder, declaration, () => {
      if (statement.init && statement.init.type !== 'VariableDeclaration') {
        resolveExpr(binder, statement.init);
      }
      if (statement.test) {
        resolveExpr(binder, statement.test);
      }
      if (statement.update) {
        resolveExpr(binder, statement.update);
      }
      bindStatement(binder, statement.body);
    });
  },

  ForOfStatement: bindForInOf,
  ForInStatement: bindForInOf,

  SwitchStatement: (binder: BinderContext, statement: SwitchStatement) => {
    resolveExpr(binder, statement.discriminant);
    binder.openScope('block');
    const clauses = statement.cases.flatMap((clause) => clause.consequent);
    hoistFunctions(binder, clauses);
    hoistTypes(binder, clauses);
    hoistClasses(binder, clauses);
    for (const clause of statement.cases) {
      if (clause.test) {
        resolveExpr(binder, clause.test);
      }
      for (const consequent of clause.consequent) {
        bindStatement(binder, consequent);
      }
    }
    binder.closeScope();
  },

  ThrowStatement: (binder: BinderContext, statement: ThrowStatement) => {
    resolveExpr(binder, statement.argument);
  },

  TryStatement: (binder: BinderContext, statement: TryStatement) => {
    bindStatement(binder, statement.block);
    if (statement.handler) {
      if (statement.handler.param) {
        binder.openScope('catch');
        declarePattern(binder, statement.handler.param);
        bindStatement(binder, statement.handler.body);
        binder.closeScope();
      } else {
        bindStatement(binder, statement.handler.body);
      }
    }
    if (statement.finalizer) {
      bindStatement(binder, statement.finalizer);
    }
  },

  LabeledStatement: (binder: BinderContext, statement: LabeledStatement) => {
    binder.declare('label', statement.label);
    bindStatement(binder, statement.body);
  },

  BreakStatement: (binder: BinderContext, statement: BreakStatement) => {
    if (statement.label) {
      binder.resolve('label', statement.label);
    }
  },

  ContinueStatement: (binder: BinderContext, statement: ContinueStatement) => {
    if (statement.label) {
      binder.resolve('label', statement.label);
    }
  },

  TSTypeAliasDeclaration: (
    binder: BinderContext,
    statement: TSTypeAliasDeclaration,
  ) => {
    declareTypeAlias(binder, statement);
  },

  TSInterfaceDeclaration: (
    binder: BinderContext,
    statement: TSInterfaceDeclaration,
  ) => {
    declareInterface(binder, statement);
  },

  TSEnumDeclaration: (binder: BinderContext, statement: TSEnumDeclaration) => {
    declareEnum(binder, statement);
  },

  ImportDeclaration: (binder: BinderContext, statement: ImportDeclaration) => {
    declareImport(binder, statement);
  },

  ExportNamedDeclaration: (
    binder: BinderContext,
    statement: ExportNamedDeclaration,
  ) => {
    bindExportNamed(binder, statement, bindStatement);
  },

  ExportDefaultDeclaration: (
    binder: BinderContext,
    statement: ExportDefaultDeclaration,
  ) => {
    bindExportDefault(binder, statement, bindStatement);
  },
};

export function bindStatementList(
  binder: BinderContext,
  statements: Array<Statement | ModuleDeclaration>,
) {
  hoistImports(binder, statements);
  hoistFunctions(binder, statements);
  hoistTypes(binder, statements);
  hoistClasses(binder, statements);
  for (const statement of statements) {
    bindStatement(binder, statement);
  }
  bindLocalExportSpecifiers(binder, statements);
}

export function bindStatement(
  binder: BinderContext,
  statement: Statement | ModuleDeclaration,
) {
  if (binder.isInvalid(statement)) {
    return;
  }
  const bind = binders[statement.type as keyof typeof binders];
  if (bind) {
    bind(binder, statement as never);
  }
}
