import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Container,
  EmptyState,
  Grid,
  PageHeader,
  Panel,
  Stack,
} from "willa";
import { ObjectTree } from "./components/ObjectTree.tsx";
import {
  formatConsoleStack,
  StackList,
  type StackFrame,
} from "./components/StackList.tsx";
import { run } from "./lib/index.ts";

type Run = typeof run;

const parseStack = (error: unknown) => {
  if (!(error instanceof Error) || !error.stack) {
    return [] as StackFrame[];
  }

  return error.stack
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^at\s+(?:(.+?)\s+)?\(?(.+):(\d+):(\d+)\)?$/.exec(line);
      if (!match) {
        return {
          functionName: "<anonymous>",
          location: line.replace(/^at\s+/, ""),
          source: line,
        };
      }

      return {
        functionName: match[1] ?? "<anonymous>",
        location: `${match[2]}:${match[3]}:${match[4]}`,
        source: line,
      };
    });
};

const inspect = async (runFn: Run) => {
  try {
    return {
      ok: true,
      object: await runFn(),
      stack: [] as StackFrame[],
    };
  } catch (error) {
    return {
      ok: false,
      object: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
      stack: parseStack(error),
    };
  }
};

export default function App() {
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof inspect>
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    const execute = (runFn: Run) => {
      void inspect(runFn).then((next) => {
        if (!cancelled) {
          setSnapshot(next);
        }
      });
    };

    execute(run);
    import.meta.hot?.accept("./lib/index.ts", (mod) => {
      if (mod?.run) {
        execute(mod.run);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    console.log(snapshot.object);
    if (snapshot.stack.length > 0) {
      const error = new Error();
      error.stack = formatConsoleStack(snapshot.stack);
      console.log(error);
    }
  }, [snapshot]);

  const objectCount = useMemo(() => {
    if (
      !snapshot ||
      snapshot.object === null ||
      typeof snapshot.object !== "object"
    ) {
      return 0;
    }
    return Object.keys(snapshot.object).length;
  }, [snapshot]);

  return (
    <Container size="xl" padding="lg">
      <Stack gap="md">
        <PageHeader
          divided
          eyebrow="Nxts Playground"
          title="调试结果"
          description="展示 app/src/lib 里 run() 的返回值和错误堆栈。"
          meta={
            <Badge
              tone={
                snapshot == null
                  ? "neutral"
                  : snapshot.ok
                    ? "success"
                    : "danger"
              }
              variant="soft"
            >
              {snapshot == null ? "未运行" : snapshot.ok ? "成功" : "失败"}
            </Badge>
          }
        />

        <Grid columns={2} minColumnWidth="280px" gap="md" align="stretch">
          <Panel
            title="对象"
            padding="sm"
            actions={
              <Badge size="sm" tone="neutral" variant="soft">
                {objectCount} keys
              </Badge>
            }
          >
            <div className="app-scroll">
              {snapshot ? (
                <ObjectTree value={snapshot.object} />
              ) : (
                <EmptyState
                  compact
                  size="sm"
                  variant="plain"
                  title="暂无对象"
                  description="run() 的返回值会显示在这里"
                />
              )}
            </div>
          </Panel>

          <Panel
            title="堆栈"
            padding="sm"
            actions={
              <Badge
                size="sm"
                tone={
                  snapshot == null ? "neutral" : snapshot.ok ? "info" : "danger"
                }
                variant="soft"
              >
                {snapshot?.stack.length ?? 0} frames
              </Badge>
            }
          >
            <div className="app-scroll">
              <StackList frames={snapshot?.stack ?? []} />
            </div>
          </Panel>
        </Grid>
      </Stack>
    </Container>
  );
}
