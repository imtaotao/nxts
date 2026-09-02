import type {
  BindFileResult,
  FileExport,
  ModuleEdge,
  NameSpace,
  ResolveExportResult,
} from './types';

const edgeKey = (fromFileId: number, specifier: string) => {
  return `${fromFileId}\0${specifier}`;
};

const visitKey = (fileId: number, name: string, space: NameSpace) => {
  return `${fileId}\0${space}\0${name}`;
};

const hitKey = (hit: { fileId: number; symbolId: number }) => {
  return `${hit.fileId}\0${hit.symbolId}`;
};

export class ExportResolver {
  private readonly exportsByFile: Map<number, readonly FileExport[]>;
  private readonly fileByEdge: Map<string, number>;

  constructor(
    files: readonly Pick<BindFileResult, 'snapshot' | 'exports'>[],
    edges: readonly ModuleEdge[],
  ) {
    this.exportsByFile = new Map(
      files.map((file) => [file.snapshot.fileId, file.exports]),
    );
    this.fileByEdge = new Map(
      edges.map((edge) => [
        edgeKey(edge.fromFileId, edge.specifier),
        edge.toFileId,
      ]),
    );
  }

  fileIdOf(fromFileId: number, specifier: string) {
    return this.fileByEdge.get(edgeKey(fromFileId, specifier)) ?? null;
  }

  resolve(
    fileId: number,
    name: string,
    space: NameSpace,
    visited: Set<string> = new Set(),
  ): ResolveExportResult {
    const key = visitKey(fileId, name, space);
    if (visited.has(key)) {
      return { kind: 'missing' };
    }
    visited.add(key);

    const exports = this.exportsByFile.get(fileId);
    if (exports == null) {
      return { kind: 'missing' };
    }

    const explicits = exports.filter(
      (item) => item.name === name && item.space === space,
    );
    if (explicits.length > 0) {
      return this.combine(
        explicits.map((item) =>
          this.resolveExplicit(fileId, item, space, visited),
        ),
      );
    }

    if (name === 'default') {
      return { kind: 'missing' };
    }

    return this.combine(
      exports
        .filter((item) => item.name === '*' && item.space === space)
        .map((item) => this.resolveStar(fileId, item, name, space, visited)),
    );
  }

  private resolveExplicit(
    fileId: number,
    item: FileExport,
    space: NameSpace,
    visited: Set<string>,
  ): ResolveExportResult {
    if (item.source == null) {
      if (item.symbolId == null) {
        return { kind: 'missing' };
      }
      return { kind: 'found', fileId, symbolId: item.symbolId };
    }
    const target = this.fileIdOf(fileId, item.source);
    if (target == null) {
      return { kind: 'missing' };
    }
    if (item.imported === '*') {
      return { kind: 'namespace', fileId: target };
    }
    if (item.imported == null) {
      return { kind: 'missing' };
    }
    return this.resolve(target, item.imported, space, visited);
  }

  private resolveStar(
    fileId: number,
    item: FileExport,
    name: string,
    space: NameSpace,
    visited: Set<string>,
  ): ResolveExportResult {
    if (item.source == null) {
      return { kind: 'missing' };
    }
    const target = this.fileIdOf(fileId, item.source);
    if (target == null) {
      return { kind: 'missing' };
    }
    return this.resolve(target, name, space, visited);
  }

  private combine(results: ResolveExportResult[]): ResolveExportResult {
    const found: Array<{ fileId: number; symbolId: number }> = [];
    const namespaces: number[] = [];
    const foundSeen = new Set<string>();
    const namespaceSeen = new Set<number>();
    for (const result of results) {
      if (result.kind === 'ambiguous') {
        return { kind: 'ambiguous' };
      }
      if (result.kind === 'found') {
        const key = hitKey(result);
        if (foundSeen.has(key)) {
          continue;
        }
        foundSeen.add(key);
        found.push(result);
        continue;
      }
      if (result.kind !== 'namespace') {
        continue;
      }
      if (namespaceSeen.has(result.fileId)) {
        continue;
      }
      namespaceSeen.add(result.fileId);
      namespaces.push(result.fileId);
    }
    if (found.length + namespaces.length === 0) {
      return { kind: 'missing' };
    }
    if (found.length === 1 && namespaces.length === 0) {
      return {
        kind: 'found',
        fileId: found[0].fileId,
        symbolId: found[0].symbolId,
      };
    }
    if (found.length === 0 && namespaces.length === 1) {
      return { kind: 'namespace', fileId: namespaces[0] };
    }
    return { kind: 'ambiguous' };
  }
}
