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
import { run, type PlaygroundFile } from './lib/index.ts';

const DEFAULT_FILES: PlaygroundFile[] = [
  {
    path: 'main.ts',
    source: `import { seed } from './seed';
import type { Count } from './count';

export const n: Count = seed;

export function f(items: Count[]): Count {
  const add = (a: Count) => a + n;
  const { head } = { head: n };

  switch (n) {
    case 1:
      let m: Count = add(head);
      return m;
    default:
      break;
  }

  try {
    throw n;
  } catch (e) {
    loop: for (const item of items) {
      if (item === n) {
        break loop;
      }
    }
    return e;
  }
}

function usedBeforeDecl(): Count {
  return later();
  function later(): Count {
    return n;
  }
}

export enum Kind {
  Ready,
  Busy = Ready,
}

export const kind: Kind = Kind.Ready;
`,
  },
  {
    path: 'seed.ts',
    source: 'export const seed = 1;\n',
  },
  {
    path: 'count.ts',
    source: 'export type Count = number;\n',
  },
];

const FILES_STORAGE_KEY = 'nxts.playground.files';
const SOURCE_STORAGE_KEY = 'nxts.playground.source';

type StoredWorkspace = {
  files: PlaygroundFile[];
  activePath: string;
};

const isWorkspace = (value: unknown): value is StoredWorkspace => {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const workspace = value as StoredWorkspace;
  return (
    Array.isArray(workspace.files) &&
    workspace.files.every(
      (file) =>
        file != null &&
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
      files: DEFAULT_FILES,
      activePath: DEFAULT_FILES[0].path,
    };
  }
  return {
    files: DEFAULT_FILES,
    activePath: DEFAULT_FILES[0].path,
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

const bindWorkspace = async (files: readonly PlaygroundFile[]) => {
  const result = await run(files);
  console.log(result);
  const diagnosticCount =
    result.diagnostics.length +
    result.files.reduce((count, file) => count + file.diagnostics.length, 0);
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
      setStatus(await bindWorkspace(workspace));
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
    setFiles(DEFAULT_FILES);
    setActivePath(DEFAULT_FILES[0].path);
    void execute(DEFAULT_FILES);
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
          description='多文件会保存在浏览器里。绑定走 bindProgram，结果打到控制台。'
          meta={
            <Badge
              tone={
                status == null
                  ? 'neutral'
                  : status.complete
                    ? 'success'
                    : 'danger'
              }
              variant='soft'
            >
              {status == null
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
                disabled={sameFiles(files, DEFAULT_FILES)}
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
                绑定
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
