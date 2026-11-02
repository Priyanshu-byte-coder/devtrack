const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const yaml = require("js-yaml");
const methods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)]
    );
}
function routeMethods(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  const found = new Set();
  for (const stmt of source.statements) {
    const exported = stmt.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    );
    if (
      exported &&
      ts.isFunctionDeclaration(stmt) &&
      stmt.name &&
      methods.has(stmt.name.text)
    )
      found.add(stmt.name.text.toLowerCase());
    if (exported && ts.isVariableStatement(stmt))
      for (const declaration of stmt.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          methods.has(declaration.name.text)
        )
          found.add(declaration.name.text.toLowerCase());
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause)
    )
      for (const item of stmt.exportClause.elements)
        if (methods.has(item.name.text))
          found.add(item.name.text.toLowerCase());
  }
  return [...found].sort();
}
const original = yaml.load(fs.readFileSync("public/openapi.yaml", "utf8"));
const spec = structuredClone(original);
spec.paths = {};
spec.components.securitySchemes.cronAuth = {
  type: "http",
  scheme: "bearer",
  description:
    "CRON_SECRET supplied by the scheduler; all environments enforce it.",
};
spec.components.securitySchemes.localCodingKey = {
  type: "http",
  scheme: "bearer",
  description: "Personal DevTrack local coding API key.",
};
spec.components.securitySchemes.leaderboardRebuild = {
  type: "apiKey",
  in: "header",
  name: "x-devtrack-rebuild-token",
  description: "LEADERBOARD_REBUILD_TOKEN supplied by a trusted operator.",
};
spec.components.securitySchemes.githubWebhook = {
  type: "apiKey",
  in: "header",
  name: "x-hub-signature-256",
  description:
    "HMAC SHA-256 of the raw request body using GITHUB_WEBHOOK_SECRET.",
};
spec.components.securitySchemes.cookieAuth.description =
  "HttpOnly NextAuth cookie; HTTPS uses the __Secure- prefix. Provider tokens are never returned to browser clients.";
spec.components.schemas.Goal.properties = {
  id: { type: "string" },
  title: { type: "string" },
  target: { type: "integer" },
  current: { type: "integer" },
  unit: { type: "string" },
  repo: { type: ["string", "null"] },
  recurrence: { type: "string", enum: ["none", "weekly", "monthly"] },
  created_at: { type: "string", format: "date-time" },
};
spec.components.schemas.Streak.properties = {
  current: { type: "integer" },
  longest: { type: "integer" },
  lastCommitDate: { type: ["string", "null"] },
  totalActiveDays: { type: "integer" },
  complete: {
    type: "boolean",
    description:
      "False when the requested commit history could not be fully collected.",
  },
};
const problems = [];
let operations = 0;
for (const file of walk("src/app/api")
  .filter((file) => /[/\\]route\.[cm]?[jt]sx?$/.test(file))
  .sort()) {
  const relative = path
    .relative("src/app", path.dirname(file))
    .replaceAll(path.sep, "/");
  const url = "/" + relative.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, "{$1}");
  const declared = routeMethods(file);
  const source = fs.readFileSync(file, "utf8");
  const existing =
    original.paths[url] ||
    (url === "/api/badge/streak-shield"
      ? original.paths["/api/badge/streak"]
      : undefined) ||
    {};
  const item = {};
  for (const method of declared) {
    operations++;
    const moved = method === "patch" ? existing.put : undefined;
    const operation = structuredClone(existing[method] || moved || {});
    operation.operationId = `${method}_${relative.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    operation.summary ||= `${method.toUpperCase()} ${url}`;
    operation.tags ||= [relative.split("/")[1]];
    operation.responses ||= {
      200: {
        description:
          "Successful response. See the route contract for the returned JSON fields.",
      },
    };
    if (!existing[method] && !moved)
      operation["x-contract-detail"] =
        "Route and method are verified from source; endpoint-specific JSON schemas have not yet been expanded.";
    if (
      source.includes("validateCronRequest") &&
      (method === "get" || !source.includes("getServerSession"))
    )
      operation.security = [{ cronAuth: [] }];
    else if (source.includes("getServerSession"))
      operation.security = [{ cookieAuth: [] }];
    else operation.security = [];
    if (url === "/api/local-coding/sync")
      operation.security = [{ localCodingKey: [] }];
    if (url === "/api/leaderboard/rebuild")
      operation.security = [{ leaderboardRebuild: [] }];
    if (source.includes("x-hub-signature-256"))
      operation.security = [{ githubWebhook: [] }];
    const names = [...url.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    const otherParams = (operation.parameters || []).filter(
      (parameter) => parameter.in !== "path"
    );
    operation.parameters = [
      ...otherParams,
      ...names.map((name) => ({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
        ...(relative.includes(`[...${name}]`)
          ? {
              description:
                "Catch-all NextAuth operation path; may contain multiple segments.",
            }
          : {}),
      })),
    ];
    if (!operation.parameters.length) delete operation.parameters;
    if (relative.includes("[...")) operation["x-nextjs-catchall"] = true;
    if (relative.startsWith("api/metrics/")) {
      operation.responses["429"] = {
        description:
          "GitHub or application rate limit. Retry after the cooldown.",
        headers: {
          "Retry-After": {
            schema: { type: "integer" },
            description: "Seconds before retrying.",
          },
        },
      };
    }
    item[method] = operation;
  }
  spec.paths[url] = item;
  if (
    JSON.stringify(
      Object.keys(existing)
        .filter((key) => methods.has(key.toUpperCase()))
        .sort()
    ) !== JSON.stringify(declared)
  )
    problems.push(url);
}
if (process.argv.includes("--check")) {
  const expected = JSON.stringify(spec.paths);
  if (
    expected !== JSON.stringify(original.paths) ||
    JSON.stringify(spec.components) !== JSON.stringify(original.components)
  ) {
    console.error(
      "OpenAPI differs from source contracts. Run npm run api:generate."
    );
    process.exitCode = 1;
  } else
    console.log(
      `OpenAPI verified: ${Object.keys(spec.paths).length} paths, ${operations} operations.`
    );
} else {
  fs.writeFileSync(
    "public/openapi.yaml",
    yaml.dump(spec, { lineWidth: 110, noRefs: true, sortKeys: false })
  );
  console.log(
    `OpenAPI synchronized: ${Object.keys(spec.paths).length} paths, ${operations} operations.`
  );
}
