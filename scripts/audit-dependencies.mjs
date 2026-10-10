/** Checks that imported packages are declared by their workspace. */
import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";
import { root, workspaces } from "./workspaces.mjs";

const WORKSPACES = workspaces().filter((workspace) => workspace !== root);
const BUILTINS = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/, "")]),
);

const SKIP_DIRS = new Set(["node_modules", "dist", "generated"]);
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

function declaredFor(workspace) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(workspace, "package.json"), "utf8"),
  );
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function moduleSpecifiers(file, source) {
  const extension = path.extname(file);
  const scriptKind = scriptKindFor(extension);
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const specifiers = new Set(
    sourceFile.typeReferenceDirectives.map((directive) => directive.fileName),
  );
  const unresolved = [];

  function visit(node) {
    if (!addStaticSpecifier(node, specifiers)) {
      collectCallSpecifier(node, sourceFile, specifiers, unresolved);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { specifiers, unresolved };
}

function scriptKindFor(extension) {
  if (extension === ".tsx" || extension === ".jsx") return ts.ScriptKind.TSX;
  if ([".ts", ".mts", ".cts"].includes(extension)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function addStaticSpecifier(node, specifiers) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    specifiers.add(node.moduleSpecifier.text);
    return true;
  }

  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression &&
    ts.isStringLiteral(node.moduleReference.expression)
  ) {
    specifiers.add(node.moduleReference.expression.text);
    return true;
  }

  if (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteral(node.argument.literal)
  ) {
    specifiers.add(node.argument.literal.text);
    return true;
  }

  return false;
}

function isRequireCall(expression) {
  if (ts.isIdentifier(expression)) return expression.text === "require";
  if (!ts.isPropertyAccessExpression(expression)) return false;

  const object = expression.expression;
  return (
    (ts.isIdentifier(object) &&
      object.text === "require" &&
      expression.name.text === "resolve") ||
    (ts.isIdentifier(object) &&
      object.text === "module" &&
      expression.name.text === "require")
  );
}

function collectCallSpecifier(node, sourceFile, specifiers, unresolved) {
  if (!ts.isCallExpression(node)) return;

  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  if (!isDynamicImport && !isRequireCall(node.expression)) return;

  const [argument] = node.arguments;
  const supportsStaticSpecifier =
    isDynamicImport || node.arguments.length === 1;
  if (
    supportsStaticSpecifier &&
    argument &&
    (ts.isStringLiteral(argument) ||
      ts.isNoSubstitutionTemplateLiteral(argument))
  ) {
    specifiers.add(argument.text);
    return;
  }

  unresolved.push(
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1,
  );
}

const declared = new Map(WORKSPACES.map((w) => [w, declaredFor(w)]));
const problems = [];
const unresolved = [];

for (const workspace of WORKSPACES) {
  const own = declared.get(workspace);
  const files = walk(workspace);

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const imports = moduleSpecifiers(file, source);
    for (const line of imports.unresolved) {
      unresolved.push([file, line]);
    }

    for (const spec of imports.specifiers) {
      // Relative, absolute, node builtins and package aliases are not registry
      // dependencies.
      if (/^[./]|^node:|^@\/|^#/.test(spec) || BUILTINS.has(spec)) continue;

      const parts = spec.split("/");
      const name = spec.startsWith("@")
        ? parts.slice(0, 2).join("/")
        : parts[0];
      if (!own.has(name)) {
        problems.push([
          file,
          name,
          `not declared in ${path.relative(root, workspace)}/package.json`,
        ]);
      }
    }
  }
}

const rel = (f) => path.relative(root, f).replaceAll("\\", "/");

console.log(`workspaces checked: ${WORKSPACES.length}`);
console.log(`undeclared imports: ${problems.length}`);
console.log(`unresolved dynamic imports: ${unresolved.length}`);
for (const [file, spec, why] of problems) {
  console.log(`  ${rel(file)} -> ${spec} (${why})`);
}
for (const [file, line] of unresolved) {
  console.log(`  ${rel(file)}:${line} -> computed module specifier`);
}

if (problems.length > 0 || unresolved.length > 0) {
  console.error(
    "\nDeclare missing dependencies in the importing workspace or make computed module specifiers explicit.",
  );
  process.exit(1);
}
