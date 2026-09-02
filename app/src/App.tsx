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
import { run } from './lib/index.ts';

const DEFAULT_SOURCE = `import { seed } from './seed';
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
`;

const SOURCE_STORAGE_KEY = 'nxts.playground.source';

const readStoredSource = () => {
  try {
    return localStorage.getItem(SOURCE_STORAGE_KEY) ?? DEFAULT_SOURCE;
  } catch {
    return DEFAULT_SOURCE;
  }
};

const writeStoredSource = (source: string) => {
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, source);
  } catch {
    return;
  }
};

type RunStatus = {
  complete: boolean;
  diagnosticCount: number;
};

const bindSource = async (source: string) => {
  const result = await run(source);
  console.log(result);
  return {
    complete: result.diagnostics.length === 0,
    diagnosticCount: result.diagnostics.length,
  };
};

export function App() {
  const [source, setSource] = useState(readStoredSource);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [running, setRunning] = useState(false);

  const execute = useCallback(async (text: string) => {
    setRunning(true);
    try {
      setStatus(await bindSource(text));
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
    writeStoredSource(source);
  }, [source]);

  useEffect(() => {
    void execute(readStoredSource());
  }, [execute]);

  const restoreDemo = () => {
    setSource(DEFAULT_SOURCE);
    void execute(DEFAULT_SOURCE);
  };

  return (
    <Container size='xl' padding='lg'>
      <Stack gap='md'>
        <PageHeader
          divided
          eyebrow='Nxts Playground'
          title='源码'
          description='改动会保存在浏览器里。绑定结果打到控制台。'
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
          title='test.ts'
          padding='sm'
          actions={
            <Group gap='sm' align='center'>
              <Kbd size='sm'>⌘↵</Kbd>
              <Button
                size='sm'
                disabled={source === DEFAULT_SOURCE}
                onClick={restoreDemo}
              >
                恢复默认
              </Button>
              <Button
                size='sm'
                loading={running}
                onClick={() => {
                  void execute(source);
                }}
              >
                绑定
              </Button>
            </Group>
          }
        >
          <TextArea
            className='app-source'
            spellCheck={false}
            resize='vertical'
            rows={32}
            width='100%'
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void execute(source);
              }
            }}
          />
        </Panel>
      </Stack>
    </Container>
  );
}
