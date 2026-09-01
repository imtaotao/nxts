import { useCallback, useEffect, useState } from "react";
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
} from "willa";
import { run } from "./lib/index.ts";

const DEFAULT_SOURCE = `const n: number = 1;

function f(items: number[]): number {
  const add = (a: number) => a + n;
  const { head } = { head: n };

  switch (n) {
    case 1:
      let m: number = add(head);
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

function usedBeforeDecl(): number {
  return later();
  function later(): number {
    return n;
  }
}
`;

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

export default function App() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
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
    void execute(DEFAULT_SOURCE);
  }, [execute]);

  return (
    <Container size="xl" padding="lg">
      <Stack gap="md">
        <PageHeader
          divided
          eyebrow="Nxts Playground"
          title="源码"
          description="在这里改代码后绑定。结果打到浏览器控制台。"
          meta={
            <Badge
              tone={
                status == null
                  ? "neutral"
                  : status.complete
                    ? "success"
                    : "danger"
              }
              variant="soft"
            >
              {status == null
                ? "未运行"
                : status.complete
                  ? "complete"
                  : `${status.diagnosticCount} diagnostics`}
            </Badge>
          }
        />

        <Panel
          title="test.ts"
          padding="sm"
          actions={
            <Group gap="sm" align="center">
              <Kbd size="sm">⌘↵</Kbd>
              <Button
                size="sm"
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
            className="app-source"
            spellCheck={false}
            resize="vertical"
            rows={32}
            width="100%"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
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
