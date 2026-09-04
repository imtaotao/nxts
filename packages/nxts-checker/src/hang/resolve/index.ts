import { resolveAccess } from './access';
import { resolveArray, resolveObject, resolveTuple } from './collection';
import { resolveIntersection, resolveUnion } from './combinator';
import {
  resolveConditional,
  resolveInfer,
  resolveMapped,
  resolveTemplate,
} from './computed';
import { resolveConstructor } from './constructor';
import { resolveFunction } from './function';
import { resolveKeyword } from './keyword';
import { resolveLiteral } from './literal';
import { resolveOperator } from './operator';
import { resolveQuery } from './query';
import { resolveReference } from './reference';
import {
  resolveImportType,
  resolvePredicate,
  resolveRejectedKeyword,
  resolveThisType,
} from './special';
import type { TypeResolver } from './shared';

export const resolveByType: Record<string, TypeResolver> = {
  TSBooleanKeyword: resolveKeyword,
  TSNumberKeyword: resolveKeyword,
  TSStringKeyword: resolveKeyword,
  TSSymbolKeyword: resolveKeyword,
  TSNullKeyword: resolveKeyword,
  TSUndefinedKeyword: resolveKeyword,
  TSVoidKeyword: resolveKeyword,
  TSNeverKeyword: resolveKeyword,
  TSAnyKeyword: resolveRejectedKeyword,
  TSUnknownKeyword: resolveRejectedKeyword,
  TSObjectKeyword: resolveRejectedKeyword,
  TSBigIntKeyword: resolveRejectedKeyword,
  TSIntrinsicKeyword: resolveRejectedKeyword,
  TSArrayType: resolveArray,
  TSTupleType: resolveTuple,
  TSFunctionType: resolveFunction,
  TSConstructorType: resolveConstructor,
  TSLiteralType: resolveLiteral,
  TSTypeOperator: resolveOperator,
  TSTypeLiteral: resolveObject,
  TSUnionType: resolveUnion,
  TSIntersectionType: resolveIntersection,
  TSTypeReference: resolveReference,
  TSIndexedAccessType: resolveAccess,
  TSTypeQuery: resolveQuery,
  TSConditionalType: resolveConditional,
  TSInferType: resolveInfer,
  TSMappedType: resolveMapped,
  TSTemplateLiteralType: resolveTemplate,
  TSThisType: resolveThisType,
  TSTypePredicate: resolvePredicate,
  TSImportType: resolveImportType,
};
