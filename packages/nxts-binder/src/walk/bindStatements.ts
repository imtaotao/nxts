import type {
  BlockStatement,
  BreakStatement,
  ContinueStatement,
  DoWhileStatement,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  LabeledStatement,
  ModuleDeclaration,
  ReturnStatement,
  Statement,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
  VariableDeclaration,
  WhileStatement,
} from "@babel/types";
import type { BinderContext } from "../context";
import { declareFunction } from "../declare/function";
import { declarePattern } from "../declare/pattern";
import { declareVariable } from "../declare/variable";
import { resolveExpr } from "./resolveExpr";

const bindForBinding = (
  binder: BinderContext,
  declaration: VariableDeclaration | null,
  rest: () => void,
) => {
  if (declaration) {
    binder.openScope("block");
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
    statement.left.type === "VariableDeclaration" ? statement.left : null;

  bindForBinding(binder, declaration, () => {
    if (statement.left.type !== "VariableDeclaration") {
      resolveExpr(binder, statement.left);
    }
    resolveExpr(binder, statement.right);
    bindStatement(binder, statement.body);
  });
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
    binder.openScope("block");
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
      statement.init?.type === "VariableDeclaration" ? statement.init : null;

    bindForBinding(binder, declaration, () => {
      if (statement.init && statement.init.type !== "VariableDeclaration") {
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
    binder.openScope("block");
    hoistFunctions(
      binder,
      statement.cases.flatMap((clause) => clause.consequent),
    );
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
        binder.openScope("catch");
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
    binder.declare("label", statement.label);
    bindStatement(binder, statement.body);
  },

  BreakStatement: (binder: BinderContext, statement: BreakStatement) => {
    if (statement.label) {
      binder.resolve("label", statement.label);
    }
  },

  ContinueStatement: (binder: BinderContext, statement: ContinueStatement) => {
    if (statement.label) {
      binder.resolve("label", statement.label);
    }
  },
};

const hoistFunctions = (
  binder: BinderContext,
  statements: Array<Statement | ModuleDeclaration>,
) => {
  for (const statement of statements) {
    if (statement.type === "FunctionDeclaration" && statement.id) {
      binder.declare("value", statement.id);
    }
  }
};

export function bindStatementList(
  binder: BinderContext,
  statements: Array<Statement | ModuleDeclaration>,
) {
  hoistFunctions(binder, statements);
  for (const statement of statements) {
    bindStatement(binder, statement);
  }
}

export function bindStatement(
  binder: BinderContext,
  statement: Statement | ModuleDeclaration,
) {
  const bind = binders[statement.type as keyof typeof binders];
  if (bind) {
    bind(binder, statement as never);
  }
}
