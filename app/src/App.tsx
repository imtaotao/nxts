import { isNil } from 'aidly';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Container,
  Group,
  Kbd,
  PageHeader,
  Panel,
  Stack,
  TextArea,
} from 'willa';
import { defaultFiles } from './demos/index.ts';
import { run, type PlaygroundFile } from './lib/index.ts';

const FILES_STORAGE_KEY = 'nxts.playground.files';
const SOURCE_STORAGE_KEY = 'nxts.playground.source';

type StoredWorkspace = {
  files: PlaygroundFile[];
  activePath: string;
};

const isWorkspace = (value: unknown): value is StoredWorkspace => {
  if (isNil(value) || typeof value !== 'object') {
    return false;
  }
  const workspace = value as StoredWorkspace;
  return (
    Array.isArray(workspace.files) &&
    workspace.files.every(
      (file) =>
        !isNil(file) &&
        typeof file.path === 'string' &&
        typeof file.source === 'string',
    ) &&
    typeof workspace.activePath === 'string'
  );
};

const readStoredWorkspace = () => {
  try {
    const raw = localStorage.getItem(FILES_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isWorkspace(parsed) && parsed.files.length > 0) {
        const activePath = parsed.files.some(
          (file) => file.path === parsed.activePath,
        )
          ? parsed.activePath
          : parsed.files[0].path;
        return { files: parsed.files, activePath };
      }
    }
    const source = localStorage.getItem(SOURCE_STORAGE_KEY);
    if (source) {
      return {
        files: [{ path: 'main.ts', source }],
        activePath: 'main.ts',
      };
    }
  } catch {
    return {
      files: defaultFiles,
      activePath: defaultFiles[0].path,
    };
  }
  return {
    files: defaultFiles,
    activePath: defaultFiles[0].path,
  };
};

const writeStoredWorkspace = (workspace: StoredWorkspace) => {
  try {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    return;
  }
};

const nextUnusedPath = (files: readonly PlaygroundFile[]) => {
  if (!files.some((file) => file.path === 'mod.ts')) {
    return 'mod.ts';
  }
  let index = 2;
  while (files.some((file) => file.path === `mod${index}.ts`)) {
    index += 1;
  }
  return `mod${index}.ts`;
};

const sameFiles = (
  left: readonly PlaygroundFile[],
  right: readonly PlaygroundFile[],
) => {
  return (
    left.length === right.length &&
    left.every(
      (file, index) =>
        file.path === right[index]?.path &&
        file.source === right[index]?.source,
    )
  );
};

type RunStatus = {
  complete: boolean;
  diagnosticCount: number;
};

const hungOf = (result: Awaited<ReturnType<typeof run>>) =>
  result.bind.files.map((file, index) => {
    const checked = result.check.files[index];
    const typeOf = (id: number | null) =>
      isNil(id) ? null : (result.check.types[id] ?? null);
    return {
      path: file.snapshot.canonicalPath,
      symbols: file.symbols.flatMap((symbol) => {
        const type = typeOf(checked?.symbolTypes[symbol.id] ?? null);
        if (isNil(type)) {
          return [];
        }
        return [{ name: symbol.name, space: symbol.space, type }];
      }),
      nodes: file.nodes.flatMap((node, nodeId) => {
        const type = typeOf(checked?.nodeTypes[nodeId] ?? null);
        if (isNil(type)) {
          return [];
        }
        return [{ node: node.type, type }];
      }),
    };
  });

const checkWorkspace = async (files: readonly PlaygroundFile[]) => {
  const result = await run(files);
  console.log(hungOf(result));
  console.log(result.bind);
  console.log(result.check);
  const diagnosticCount =
    result.bind.diagnostics.length +
    result.bind.files.reduce(
      (count, file) => count + file.diagnostics.length,
      0,
    ) +
    result.check.diagnostics.length +
    result.check.files.reduce(
      (count, file) => count + file.diagnostics.length,
      0,
    );
  return {
    complete: diagnosticCount === 0,
    diagnosticCount,
  };
};

export function App() {
  const initial = readStoredWorkspace();
  const [files, setFiles] = useState(initial.files);
  const [activePath, setActivePath] = useState(initial.activePath);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [running, setRunning] = useState(false);
  const activeFile = files.find((file) => file.path === activePath) ?? files[0];

  const execute = useCallback(async (workspace: readonly PlaygroundFile[]) => {
    setRunning(true);
    try {
      setStatus(await checkWorkspace(workspace));
    } catch (error) {
      console.error(error);
      setStatus({
        complete: false,
        diagnosticCount: 0,
      });
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    writeStoredWorkspace({ files, activePath });
  }, [files, activePath]);

  useEffect(() => {
    void execute(readStoredWorkspace().files);
  }, [execute]);

  const restoreDemo = () => {
    setFiles(defaultFiles);
    setActivePath(defaultFiles[0].path);
    void execute(defaultFiles);
  };

  const addFile = () => {
    const path = nextUnusedPath(files);
    const next = [...files, { path, source: '' }];
    setFiles(next);
    setActivePath(path);
  };

  const renameFile = (path: string) => {
    const nextPath = window.prompt('文件路径', path)?.trim();
    if (!nextPath || nextPath === path) {
      return;
    }
    if (files.some((file) => file.path === nextPath)) {
      return;
    }
    setFiles(
      files.map((file) =>
        file.path === path ? { ...file, path: nextPath } : file,
      ),
    );
    if (activePath === path) {
      setActivePath(nextPath);
    }
  };

  const closeFile = (path: string) => {
    if (files.length < 2) {
      return;
    }
    const index = files.findIndex((file) => file.path === path);
    const next = files.filter((file) => file.path !== path);
    setFiles(next);
    if (activePath === path) {
      setActivePath(next[Math.max(0, index - 1)]?.path ?? next[0].path);
    }
  };

  const updateSource = (source: string) => {
    setFiles(
      files.map((file) =>
        file.path === activeFile.path ? { ...file, source } : file,
      ),
    );
  };

  return (
    <Container size='xl' padding='lg'>
      <Stack gap='md'>
        <PageHeader
          divided
          eyebrow='Nxts Playground'
          title='源码'
          description='多文件会保存在浏览器里。bindProgram 之后走 checkProgram，结果打到控制台。'
          meta={
            <Badge
              tone={
                isNil(status)
                  ? 'neutral'
                  : status.complete
                    ? 'success'
                    : 'danger'
              }
              variant='soft'
            >
              {isNil(status)
                ? '未运行'
                : status.complete
                  ? 'complete'
                  : `${status.diagnosticCount} diagnostics`}
            </Badge>
          }
        />

        <Panel
          title={activeFile.path}
          padding='sm'
          actions={
            <Group gap='sm' align='center'>
              <Kbd size='sm'>⌘↵</Kbd>
              <Button
                size='sm'
                disabled={sameFiles(files, defaultFiles)}
                onClick={restoreDemo}
              >
                恢复默认
              </Button>
              <Button
                size='sm'
                loading={running}
                onClick={() => {
                  void execute(files);
                }}
              >
                检查
              </Button>
            </Group>
          }
        >
          <Stack gap='sm'>
            <Group gap='xs' align='center' className='app-tabs'>
              {files.map((file) => (
                <Button
                  key={file.path}
                  size='sm'
                  variant={file.path === activeFile.path ? 'solid' : 'ghost'}
                  className='app-tab'
                  onClick={() => {
                    setActivePath(file.path);
                  }}
                  onDoubleClick={() => {
                    renameFile(file.path);
                  }}
                >
                  {file.path}
                  {files.length > 1 ? (
                    <span
                      className='app-tab-close'
                      onClick={(event) => {
                        event.stopPropagation();
                        closeFile(file.path);
                      }}
                    >
                      ×
                    </span>
                  ) : null}
                </Button>
              ))}
              <Button size='sm' variant='ghost' onClick={addFile}>
                +
              </Button>
            </Group>
            <TextArea
              className='app-source'
              spellCheck={false}
              resize='vertical'
              rows={32}
              width='100%'
              value={activeFile.source}
              onChange={(event) => {
                updateSource(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void execute(files);
                }
              }}
            />
          </Stack>
        </Panel>
      </Stack>
    </Container>
  );
}
