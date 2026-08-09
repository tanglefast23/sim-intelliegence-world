import { readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const PURE_ROOTS = ['src/domain', 'src/world'] as const;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const NODE_BUILTINS = new Set(builtinModules.map((moduleName) => moduleName.replace(/^node:/, '')));
const FORBIDDEN_PACKAGES = [
  '@shopify/react-native-skia',
  'electron',
  'expo',
  'react',
  'react-dom',
  'react-native',
  'react-native-reanimated',
  'react-native-web',
  'react-native-worklets',
  'zustand',
] as const;
const FORBIDDEN_INTERNAL_SEGMENTS = ['/electron/', '/src/application/', '/src/render/', '/src/ui/'] as const;

export type ImportBoundaryViolation = Readonly<{
  file: string;
  line: number;
  moduleName: string;
}>;

function isForbiddenPackage(moduleName: string): boolean {
  const bareModuleName = moduleName.replace(/^node:/, '').split('/')[0] ?? moduleName;
  return (
    NODE_BUILTINS.has(bareModuleName) ||
    moduleName === 'expo' ||
    moduleName.startsWith('expo-') ||
    moduleName.startsWith('expo/') ||
    moduleName.startsWith('@expo/') ||
    FORBIDDEN_PACKAGES.some(
      (packageName) => moduleName === packageName || moduleName.startsWith(`${packageName}/`),
    )
  );
}

function isForbiddenInternalImport(filePath: string, moduleName: string, repositoryRoot: string): boolean {
  if (!moduleName.startsWith('.')) {
    return false;
  }

  const target = resolve(filePath, '..', moduleName);
  const pureRoots = PURE_ROOTS.map((root) => resolve(repositoryRoot, root));
  const remainsPure = pureRoots.some((root) => {
    const relativeTarget = relative(root, target);
    return relativeTarget === '' || (!relativeTarget.startsWith('..') && !isAbsolute(relativeTarget));
  });

  if (!remainsPure) {
    return true;
  }

  const normalizedTarget = target.replaceAll('\\', '/');
  return FORBIDDEN_INTERNAL_SEGMENTS.some((segment) => normalizedTarget.includes(segment));
}

export function findImportBoundaryViolations(
  source: string,
  filePath: string,
  repositoryRoot: string,
): ImportBoundaryViolation[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const violations: ImportBoundaryViolation[] = [];

  const recordIfForbidden = (moduleName: string, node: ts.Node): void => {
    if (
      isForbiddenPackage(moduleName) ||
      isForbiddenInternalImport(filePath, moduleName, repositoryRoot)
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({ file: filePath, line: position.line + 1, moduleName });
    }
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      recordIfForbidden(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      recordIfForbidden(node.moduleReference.expression.text, node.moduleReference.expression);
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) {
        recordIfForbidden(argument.text, argument);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

function sourceFilesUnder(path: string): string[] {
  try {
    return readdirSync(path)
      .flatMap((entry) => {
        const entryPath = join(path, entry);
        return statSync(entryPath).isDirectory() ? sourceFilesUnder(entryPath) : [entryPath];
      })
      .filter(
        (entryPath) =>
          SOURCE_EXTENSIONS.has(extname(entryPath)) &&
          !entryPath.replaceAll('\\', '/').includes('/__tests__/'),
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export function scanPureRoots(repositoryRoot: string): ImportBoundaryViolation[] {
  return PURE_ROOTS.flatMap((root) => sourceFilesUnder(join(repositoryRoot, root))).flatMap((filePath) =>
    findImportBoundaryViolations(readFileSync(filePath, 'utf8'), filePath, repositoryRoot),
  );
}
