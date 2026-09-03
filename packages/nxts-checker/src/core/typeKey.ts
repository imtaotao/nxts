import type { TypeId, TypeShape } from '../types';

const byId = (left: TypeId, right: TypeId) => left - right;

const uniqueSorted = (ids: readonly TypeId[]) => {
  const seen = new Set<TypeId>();
  const out: TypeId[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  out.sort(byId);
  return out;
};

const sortedMembers = (
  shape: Extract<TypeShape, { props: readonly unknown[] }>,
) =>
  [...shape.props].sort((left, right) => {
    if (left.key !== right.key) {
      return left.key < right.key ? -1 : 1;
    }
    if (left.role === right.role) {
      return 0;
    }
    return left.role < right.role ? -1 : 1;
  });

export function canonicalize(shape: TypeShape) {
  switch (shape.kind) {
    case 'object':
    case 'interface':
    case 'dictionary':
      return { ...shape, props: sortedMembers(shape) };
    case 'union':
    case 'intersection':
      return { ...shape, members: uniqueSorted(shape.members) };
    default:
      return shape;
  }
}

const flag = (value: boolean) => (value ? 1 : 0);

const receiver = (value: TypeId | null) => value ?? -1;

const fields = (shape: TypeShape) => {
  const out: (number | string)[] = [shape.kind];
  switch (shape.kind) {
    case 'atom':
      out.push(shape.atom);
      break;
    case 'unknown':
      break;
    case 'literal':
      out.push(shape.base, shape.value.kind, String(shape.value.value));
      break;
    case 'uniqueSymbol':
    case 'enum':
    case 'typeParam':
      out.push(shape.decl.fileId, shape.decl.symbolId);
      break;
    case 'object':
      out.push(shape.props.length);
      for (const prop of shape.props) {
        out.push(
          prop.key,
          prop.type,
          flag(prop.optional),
          flag(prop.readonly),
          prop.role,
        );
      }
      break;
    case 'interface':
      out.push(shape.props.length);
      for (const prop of shape.props) {
        out.push(
          prop.key,
          prop.type,
          flag(prop.optional),
          flag(prop.readonly),
          prop.role,
        );
      }
      out.push(
        shape.calls.length,
        ...shape.calls,
        shape.args.length,
        ...shape.args,
      );
      break;
    case 'dictionary':
      out.push(
        shape.key,
        shape.value,
        flag(shape.readonly),
        shape.props.length,
      );
      for (const prop of shape.props) {
        out.push(
          prop.key,
          prop.type,
          flag(prop.optional),
          flag(prop.readonly),
          prop.role,
        );
      }
      break;
    case 'array':
      out.push(shape.element, flag(shape.readonly));
      break;
    case 'tuple':
      out.push(flag(shape.readonly), shape.elements.length);
      for (const element of shape.elements) {
        out.push(element.type, flag(element.optional), flag(element.rest));
      }
      break;
    case 'function':
      out.push(shape.signatures.length);
      for (const signature of shape.signatures) {
        out.push(
          receiver(signature.receiver),
          signature.returnType,
          signature.params.length,
        );
        for (const param of signature.params) {
          out.push(param.type, flag(param.optional), flag(param.rest));
        }
      }
      break;
    case 'union':
    case 'intersection':
      out.push(shape.members.length, ...shape.members);
      break;
    case 'brand':
      out.push(shape.base, shape.tag);
      break;
    case 'class':
    case 'classCtor':
    case 'generic':
      out.push(
        shape.decl.fileId,
        shape.decl.symbolId,
        shape.args.length,
        ...shape.args,
      );
      break;
    case 'enumMember':
      out.push(shape.enum, shape.value.kind, String(shape.value.value));
      break;
    case 'this':
      out.push(shape.classType);
      break;
  }
  return out;
};

// 把字段收成 32 位整数当 Map 键，撞了再 equalShape。
const mix = (hash: number, value: number) => (Math.imul(hash, 31) + value) | 0;

export function hashShape(shape: TypeShape) {
  let hash = 0;
  for (const field of fields(shape)) {
    if (typeof field === 'number') {
      hash = mix(hash, field);
      continue;
    }
    hash = mix(hash, field.length);
    for (let index = 0; index < field.length; index += 1) {
      hash = mix(hash, field.charCodeAt(index));
    }
  }
  return hash;
}

export function equalShape(left: TypeShape, right: TypeShape) {
  if (left.kind !== right.kind) {
    return false;
  }
  const leftFields = fields(left);
  const rightFields = fields(right);
  if (leftFields.length !== rightFields.length) {
    return false;
  }
  return leftFields.every((field, index) => field === rightFields[index]);
}
