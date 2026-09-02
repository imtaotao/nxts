import type { Identifier } from '@babel/types';
import { createDiagnostic, type MessageId } from './catalog';
import { collectModuleBindings } from './collect';
import type {
  BindEnv,
  BindFileResult,
  BinderDiagnostic,
  EnvSymbol,
  NameSpace,
  ParseFileResult,
  ScopeKind,
  ScopeRecord,
  SymbolRecord,
} from './types';

type ScopeNames = Record<NameSpace, Map<string, number>>;

const emptyNames = (): ScopeNames => ({
  value: new Map(),
  type: new Map(),
  label: new Map(),
});

export class BinderContext {
  private readonly file: ParseFileResult;
  private readonly scopes: ScopeRecord[] = [];
  private readonly symbols: SymbolRecord[] = [];
  private readonly nodeToSymbols: number[][];
  private readonly names: ScopeNames[] = [];
  private readonly diagnostics: BinderDiagnostic[] = [];
  private current: number | null = null;

  constructor(file: ParseFileResult) {
    this.file = file;
    this.nodeToSymbols = Array.from({ length: file.nodes.length }, () => []);
  }

  private nodeIdOf(node: object) {
    return (
      this.file.nodeIds.get(node as ParseFileResult['nodes'][number]) ?? null
    );
  }

  private bind(node: object, symbolId: number) {
    const nodeId = this.nodeIdOf(node);
    if (nodeId == null) return;
    const bound = this.nodeToSymbols[nodeId];
    if (!bound.includes(symbolId)) {
      bound.push(symbolId);
    }
  }

  isInvalid(node: object) {
    return this.file.invalidNodes.has(node as ParseFileResult['nodes'][number]);
  }

  isBound(node: object) {
    const nodeId = this.nodeIdOf(node);
    return nodeId != null && this.nodeToSymbols[nodeId].length > 0;
  }

  isBoundIn(node: object, space: NameSpace) {
    const nodeId = this.nodeIdOf(node);
    if (nodeId == null) {
      return false;
    }
    return this.nodeToSymbols[nodeId].some(
      (id) => this.symbols[id]?.space === space,
    );
  }

  private diagnose(messageId: MessageId, node: Identifier) {
    this.diagnostics.push(
      createDiagnostic(messageId, [node.name], {
        start: node.start ?? 0,
        end: node.end ?? 0,
        fileId: this.file.snapshot.fileId,
        sourceVersion: this.file.snapshot.sourceVersion,
      }),
    );
  }

  openScope(kind: ScopeKind) {
    const id = this.scopes.length;
    this.scopes.push({
      id,
      parent: this.current,
      kind,
    });
    this.names.push(emptyNames());
    this.current = id;
    return id;
  }

  closeScope() {
    if (this.current == null) return;
    this.current = this.scopes[this.current].parent;
  }

  installEnv(env: BindEnv) {
    this.openScope('global');
    for (const item of env.symbols) {
      this.declareEnv(item);
    }
  }

  private declareEnv(item: EnvSymbol) {
    if (this.current == null) {
      return;
    }
    const table = this.names[this.current][item.space];
    if (table.has(item.name)) {
      return;
    }
    const id = this.symbols.length;
    this.symbols.push({
      id,
      name: item.name,
      space: item.space,
      declNodeId: null,
      scopeId: this.current,
      builtinId: item.builtinId,
    });
    table.set(item.name, id);
  }

  declare(space: NameSpace, node: Identifier) {
    const nodeId = this.nodeIdOf(node);
    if (nodeId == null || this.current == null) {
      return;
    }
    const table = this.names[this.current][space];
    if (table.has(node.name)) {
      this.diagnose('binder.duplicate', node);
    }
    const id = this.symbols.length;

    this.symbols.push({
      id,
      name: node.name,
      space,
      declNodeId: nodeId,
      scopeId: this.current,
      builtinId: null,
    });

    this.bind(node, id);

    if (!table.has(node.name)) {
      table.set(node.name, id);
    }
  }

  declareOnce(space: NameSpace, node: Identifier) {
    if (this.current == null) {
      return;
    }
    const existing = this.names[this.current][space].get(node.name);
    if (existing != null) {
      this.bind(node, existing);
      return;
    }
    this.declare(space, node);
  }

  resolve(space: NameSpace, node: Identifier) {
    let scope = this.current;
    while (scope != null) {
      const id = this.names[scope][space].get(node.name);
      if (id != null) {
        this.bind(node, id);
        return;
      }
      scope = this.scopes[scope].parent;
    }
    this.diagnose('binder.unresolved', node);
  }

  finish() {
    const bound = {
      scopes: this.scopes,
      symbols: this.symbols,
      snapshot: this.file.snapshot,
      diagnostics: this.diagnostics,
      nodeToSymbols: this.nodeToSymbols,
    };
    return {
      ...bound,
      ...collectModuleBindings(this.file, bound),
      resolved: [] as BindFileResult['resolved'],
    } satisfies BindFileResult;
  }
}
