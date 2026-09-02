import { parse, type ParserOptions } from '@babel/parser';

const options: ParserOptions = {
  sourceType: 'module',
  strictMode: true,
  errorRecovery: true,
  locations: true,
  ranges: true,
  tokens: true,
  attachComment: true,
  createParenthesizedExpressions: true,
  createImportExpressions: true,
  allowImportExportEverywhere: false,
  allowAwaitOutsideFunction: false,
  allowReturnOutsideFunction: false,
  allowNewTargetOutsideFunction: false,
  allowSuperOutsideMethod: false,
  allowYieldOutsideFunction: false,
  annexB: false,
  allowUndeclaredExports: true,
  startLine: 1,
  startColumn: 0,
  plugins: [['typescript', { dts: false, disallowAmbiguousJSXLike: false }]],
};

export function babelParse(code: string, sourceFilename: string) {
  return parse(code, {
    ...options,
    sourceFilename,
  });
}
