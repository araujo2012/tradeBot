// Verifica se os functions.md de cada pasta estão em dia com os exports do código.
// Uso: node tools/check-index.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const IGNORE = new Set(["node_modules", "dist", "coverage", ".git", "scripts"]);
const CODE = /\.(ts|js)$/;
const EXPORT_RE =
  /^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|interface|type|enum)\s+(\w+)/gm;

const problems = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && CODE.test(e.name)).map((e) => e.name);
  const subdirs = entries.filter((e) => e.isDirectory() && !IGNORE.has(e.name) && !e.name.startsWith("."));
  const hasCodeBelow = subdirs.map((d) => walk(path.join(dir, d.name))).some(Boolean);
  if (!files.length && !hasCodeBelow) return false;

  const rel = path.relative(ROOT, dir) || ".";
  const indexPath = path.join(dir, "functions.md");
  if (!fs.existsSync(indexPath)) {
    problems.push(`${rel}: falta functions.md`);
    return true;
  }
  const index = fs.readFileSync(indexPath, "utf8");

  for (const file of files) {
    if (!index.includes("### `" + file + "`")) problems.push(`${rel}/functions.md: falta seção para ${file}`);
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    for (const [, name] of src.matchAll(EXPORT_RE)) {
      if (!index.includes("`" + name + "`")) problems.push(`${rel}/functions.md: export \`${name}\` de ${file} não documentado`);
    }
  }
  for (const [, file] of index.matchAll(/^### `([^`]+)`/gm)) {
    if (!files.includes(file)) problems.push(`${rel}/functions.md: seção para ${file}, que não existe mais`);
  }
  return true;
}

walk(ROOT);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("functions.md em dia.");
