import { useState } from "react";
import { isArray, isObject, toRawType } from "aidly";

type ObjectTreeProps = {
  name?: string;
  value: unknown;
};

type ConsoleNodeProps = {
  name?: string | null;
  value: unknown;
  depth: number;
  seen: object[];
};

const PREVIEW_LIMIT = 4;
const TRAILING_KEYS = new Set([
  "loc",
  "range",
  "errors",
  "comments",
  "tokens",
  "extra",
]);

const isExpandable = (value: unknown) => isObject(value);

const entriesOf = (value: object) => {
  if (isArray(value)) {
    return value.map((item, index) => [String(index), item] as const);
  }

  return Object.entries(value).toSorted(([left], [right]) => {
    if (left === "type") {
      return -1;
    }
    if (right === "type") {
      return 1;
    }
    return Number(TRAILING_KEYS.has(left)) - Number(TRAILING_KEYS.has(right));
  });
};

const primitiveClass = (value: unknown) => {
  switch (toRawType(value)) {
    case "string":
      return "console-string";
    case "number":
    case "bigint":
      return "console-number";
    case "boolean":
    case "null":
    case "undefined":
      return "console-keyword";
    case "symbol":
      return "console-symbol";
    default:
      return "console-text";
  }
};

const primitiveText = (value: unknown) => {
  if (toRawType(value) === "string") {
    return JSON.stringify(value);
  }
  if (toRawType(value) === "function") {
    return `ƒ ${(value as { name?: string }).name || "anonymous"}()`;
  }
  return String(value);
};

const PropertyKey = ({
  name,
  preview = false,
}: {
  name: string;
  preview?: boolean;
}) => (
  <>
    <span className={preview ? "console-preview-key" : "console-key"}>
      {name}
    </span>
    <span className="console-colon">:</span>
  </>
);

const objectLabel = (value: object) => {
  if (isArray(value)) {
    return `Array(${value.length})`;
  }

  const type = (value as { type?: unknown }).type;
  if (typeof type === "string") {
    return type;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) {
    return "Object";
  }
  return proto.constructor?.name || "Object";
};

const previewChild = (child: unknown, value: object, seen: object[]) => {
  if (!isExpandable(child)) {
    return (
      <span className={primitiveClass(child)}>{primitiveText(child)}</span>
    );
  }
  if (child === value || seen.includes(child)) {
    return <span className="console-muted">[Circular]</span>;
  }
  return <span className="console-type">{objectLabel(child)}</span>;
};

const inlinePreview = (value: object, seen: object[]) => {
  const entries = entriesOf(value);
  const shown = entries.slice(0, PREVIEW_LIMIT);

  if (entries.length === 0) {
    return (
      <span className="console-preview">{isArray(value) ? "[]" : "{}"}</span>
    );
  }

  return (
    <span className="console-preview">
      {isArray(value) ? "[ " : "{ "}
      {shown.map(([key, child], index) => (
        <span key={key}>
          {index > 0 ? ", " : null}
          {isArray(value) ? null : <PropertyKey name={key} preview />}
          {previewChild(child, value, seen)}
        </span>
      ))}
      {entries.length > PREVIEW_LIMIT ? ", …" : null}
      {isArray(value) ? " ]" : " }"}
    </span>
  );
};

const Arrow = ({ open = false, placeholder = false }) => (
  <span
    className={`console-arrow${open ? " is-open" : ""}${placeholder ? " is-placeholder" : ""}`}
    aria-hidden="true"
  />
);

const ConsoleNode = ({ name, value, depth, seen }: ConsoleNodeProps) => {
  const expandable = isExpandable(value);
  const [open, setOpen] = useState(depth === 0);

  if (!expandable) {
    return (
      <div className="console-line">
        <Arrow placeholder />
        {name != null ? <PropertyKey name={name} /> : null}
        <span className={primitiveClass(value)}>{primitiveText(value)}</span>
      </div>
    );
  }

  if (isArray(value) && value.length === 0) {
    return (
      <div className="console-line">
        <Arrow placeholder />
        {name != null ? <PropertyKey name={name} /> : null}
        <span className="console-type">Array(0)</span>
      </div>
    );
  }

  if (seen.includes(value)) {
    return (
      <div className="console-line">
        <Arrow placeholder />
        {name != null ? <PropertyKey name={name} /> : null}
        <span className="console-muted">[Circular]</span>
      </div>
    );
  }

  const nextSeen = [...seen, value];
  const entries = entriesOf(value);

  return (
    <div className="console-block">
      <button
        className="console-line is-toggle"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Arrow open={open} />
        {name != null ? <PropertyKey name={name} /> : null}
        <span className="console-type">{objectLabel(value)}</span>
        {inlinePreview(value, seen)}
      </button>
      {open ? (
        <div className="console-children">
          {entries.map(([key, child]) => (
            <ConsoleNode
              key={key}
              name={key}
              value={child}
              depth={depth + 1}
              seen={nextSeen}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export function ObjectTree({ name, value }: ObjectTreeProps) {
  return (
    <div className="console">
      <ConsoleNode name={name ?? null} value={value} depth={0} seen={[]} />
    </div>
  );
}
