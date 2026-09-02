import type { Identifier } from '@babel/types';
import { createDiagnostic, type MessageId } from './catalog';
import type {
  BindFileResult,
  BinderDiagnostic,
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

  isBound(node: object) {
    const nodeId = this.nodeIdOf(node);
    return nodeId != null && this.nodeToSymbols[nodeId].length > 0;
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
    });

    this.bind(node, id);
    if (!table.has(node.name)) {
      table.set(node.name, id);
    }
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
    return {
      scopes: this.scopes,
      symbols: this.symbols,
      snapshot: this.file.snapshot,
      diagnostics: this.diagnostics,
      nodeToSymbols: this.nodeToSymbols,
    } satisfies BindFileResult;
  }
}
