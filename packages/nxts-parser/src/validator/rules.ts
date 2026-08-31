import { accessorTypeParamsRule } from "./contextual/accessorTypeParams";
import { asConstRule } from "./contextual/asConst";
import { classOverloadRule } from "./contextual/classOverload";
import { constTypeParamRule } from "./contextual/constTypeParam";
import { newTargetRule } from "./contextual/newTarget";
import { optionalOrderRule } from "./contextual/optionalOrder";
import { overloadDeclareRule } from "./contextual/overloadDeclare";
import { tupleRestRule } from "./contextual/tupleRest";
import { abstractRule } from "./reject/abstract";
import { anyKeywordRule } from "./reject/anyKeyword";
import { arrayHoleRule } from "./reject/arrayHole";
import { bigintKeywordRule } from "./reject/bigintKeyword";
import { bigintLiteralRule } from "./reject/bigintLiteral";
import { bitwiseRule } from "./reject/bitwise";
import { classAccessorRule } from "./reject/classAccessor";
import { declareRule } from "./reject/declare";
import { definiteAssignmentRule } from "./reject/definiteAssignment";
import { eqeqRule } from "./reject/eqeq";
import { importEqualsRule } from "./reject/importEquals";
import { namespaceRule } from "./reject/namespace";
import { nonNullAssertionRule } from "./reject/nonNullAssertion";
import { objectKeywordRule } from "./reject/objectKeyword";
import { objectLiteralAccessorRule } from "./reject/objectLiteralAccessor";
import { overrideRule } from "./reject/override";
import { privateNameRule } from "./reject/privateName";
import { taggedTemplateRule } from "./reject/taggedTemplate";
import { typeAssertionRule } from "./reject/typeAssertion";
import { usingRule } from "./reject/using";
import { varRule } from "./reject/var";
import type { Rule } from "../types";

export const rules: Rule[] = [
  varRule,
  usingRule,
  declareRule,
  namespaceRule,
  abstractRule,
  eqeqRule,
  bitwiseRule,
  objectLiteralAccessorRule,
  arrayHoleRule,
  bigintLiteralRule,
  privateNameRule,
  overrideRule,
  definiteAssignmentRule,
  classAccessorRule,
  typeAssertionRule,
  nonNullAssertionRule,
  anyKeywordRule,
  bigintKeywordRule,
  objectKeywordRule,
  taggedTemplateRule,
  importEqualsRule,
  overloadDeclareRule,
  newTargetRule,
  optionalOrderRule,
  classOverloadRule,
  constTypeParamRule,
  accessorTypeParamsRule,
  asConstRule,
  tupleRestRule,
];
