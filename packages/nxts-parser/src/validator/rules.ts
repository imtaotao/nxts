import { accessorTypeParamsRule } from "./contextual/accessorTypeParams";
import { asConstRule } from "./contextual/asConst";
import { awaitPositionRule } from "./contextual/awaitPosition";
import { breakContinueRule } from "./contextual/breakContinue";
import { classOverloadRule } from "./contextual/classOverload";
import { constTypeParamRule } from "./contextual/constTypeParam";
import { constructorTypeParamsRule } from "./contextual/constructorTypeParams";
import { illegalAssignTargetRule } from "./contextual/illegalAssignTarget";
import { labelsRule } from "./contextual/labels";
import { newTargetRule } from "./contextual/newTarget";
import { optionalOrderRule } from "./contextual/optionalOrder";
import { overloadDeclareRule } from "./contextual/overloadDeclare";
import { returnPositionRule } from "./contextual/returnPosition";
import { staticBlockRule } from "./contextual/staticBlock";
import { tupleRestRule } from "./contextual/tupleRest";
import { typeofTypeRule } from "./contextual/typeofType";
import { varianceRule } from "./contextual/variance";
import { yieldPositionRule } from "./contextual/yieldPosition";
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
import { importAssertionsRule } from "./reject/importAssertions";
import { importEqualsRule } from "./reject/importEquals";
import { legacyOctalRule } from "./reject/legacyOctal";
import { namespaceRule } from "./reject/namespace";
import { nonNullAssertionRule } from "./reject/nonNullAssertion";
import { objectKeywordRule } from "./reject/objectKeyword";
import { objectLiteralAccessorRule } from "./reject/objectLiteralAccessor";
import { optionalChainAssignRule } from "./reject/optionalChainAssign";
import { overrideRule } from "./reject/override";
import { privateNameRule } from "./reject/privateName";
import { taggedTemplateRule } from "./reject/taggedTemplate";
import { typeAssertionRule } from "./reject/typeAssertion";
import { usingRule } from "./reject/using";
import { varRule } from "./reject/var";
import { withStatementRule } from "./reject/withStatement";
import type { Rule } from "../types";

export const rules: Rule[] = [
  varRule,
  usingRule,
  declareRule,
  namespaceRule,
  abstractRule,
  withStatementRule,
  eqeqRule,
  bitwiseRule,
  optionalChainAssignRule,
  objectLiteralAccessorRule,
  arrayHoleRule,
  legacyOctalRule,
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
  importAssertionsRule,
  importEqualsRule,
  overloadDeclareRule,
  returnPositionRule,
  breakContinueRule,
  labelsRule,
  awaitPositionRule,
  yieldPositionRule,
  newTargetRule,
  staticBlockRule,
  optionalOrderRule,
  classOverloadRule,
  constTypeParamRule,
  varianceRule,
  constructorTypeParamsRule,
  accessorTypeParamsRule,
  typeofTypeRule,
  asConstRule,
  tupleRestRule,
  illegalAssignTargetRule,
];
