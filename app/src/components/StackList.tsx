import { EmptyState } from "willa";

export type StackFrame = {
  functionName: string;
  location: string;
  source: string;
};

type StackListProps = {
  frames: StackFrame[];
};

export const formatConsoleStack = (frames: StackFrame[], message = "Error") => {
  if (frames.length === 0) {
    return message;
  }

  return [
    message,
    ...frames.map(
      (frame) => `    at ${frame.functionName} (${frame.location})`,
    ),
  ].join("\n");
};

export function StackList({ frames }: StackListProps) {
  if (frames.length === 0) {
    return (
      <EmptyState
        compact
        size="sm"
        variant="plain"
        title="暂无堆栈"
        description="运行出错时，堆栈会显示在这里"
      />
    );
  }

  return (
    <pre className="console-stack">
      {frames.map((frame) => (
        <div
          className="console-stack-line"
          key={`${frame.functionName}-${frame.location}`}
        >
          <span className="console-muted"> at </span>
          <span className="console-fn">{frame.functionName}</span>
          <span className="console-muted"> (</span>
          <span className="console-loc">{frame.location}</span>
          <span className="console-muted">)</span>
        </div>
      ))}
    </pre>
  );
}
