// Validate literal PostgREST selectors against disposable PostgreSQL, without live credentials.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const { createTestDatabase } = require("./check-database.cjs");
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)]
    );
}
function findTable(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
  ) {
    if (
      node.expression.name.text === "from" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      return node.arguments[0].text;
    return findTable(node.expression.expression);
  }
  return null;
}
async function main() {
  const db = await createTestDatabase();
  const tables = new Map();
  try {
    await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
    for (const row of (
      await db.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'"
      )
    ).rows) {
      if (!tables.has(row.table_name)) tables.set(row.table_name, new Set());
      tables.get(row.table_name).add(row.column_name);
    }
  } finally {
    await db.close();
  }
  const problems = [];
  let checked = 0;
  const columnMethods = new Set([
    "select",
    "order",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "not",
    "like",
    "ilike",
    "is",
  ]);
  for (const file of walk("src").filter((file) => /\.[jt]sx?$/.test(file))) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        columnMethods.has(node.expression.name.text) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const table = findTable(node.expression.expression);
        if (table) {
          checked++;
          let flat = "",
            depth = 0;
          for (const character of node.arguments[0].text) {
            if (character === "(") depth++;
            if (depth === 0) flat += character;
            if (character === ")") depth--;
          }
          for (const term of flat
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)) {
            const field = term.split(":").at(-1).split("!")[0];
            const [qualifiedTable, qualifiedField] = field.includes(".")
              ? field.split(".")
              : [table, field];
            if (
              field !== "*" &&
              !tables.get(qualifiedTable)?.has(qualifiedField) &&
              !tables.has(field)
            )
              problems.push(
                `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${table}.${field}`
              );
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  if (problems.length)
    throw new Error("Unknown database selectors:\n" + problems.join("\n"));
  console.log(
    `Database route contracts verified: ${checked} literal selectors, filters and ordering expressions.`
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
