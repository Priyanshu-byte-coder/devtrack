import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const file = readFileSync("public/sw.js", "utf8");
const source = ts.createSourceFile(
  "sw.js",
  file,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
);
const routes = [];
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "registerRoute"
  ) {
    const [pattern, handler] = node.arguments;
    assert.ok(
      handler &&
        ts.isNewExpression(handler) &&
        ts.isPropertyAccessExpression(handler.expression),
      "Expected an explicit Workbox strategy"
    );
    const strategy = handler.expression.name.text;
    assert.ok(
      ["NetworkOnly", "CacheFirst"].includes(strategy),
      `Forbidden personalized cache strategy: ${strategy}`
    );
    if (strategy === "NetworkOnly")
      assert.ok(
        pattern.getText(source).includes('"/api/"') ||
          pattern.getText(source).includes('"navigate"'),
        "NetworkOnly must cover API requests or navigations"
      );
    else {
      const options = handler.arguments?.[0]?.getText(source) || "";
      assert.match(
        options,
        /devtrack-(?:static|fonts)-v2/,
        "Only static/font runtime caches are allowed"
      );
    }
    if (pattern.getText(source).includes('"navigate"'))
      assert.match(
        handler.getText(source),
        /handlerDidError/,
        "Offline navigation must attach its public fallback"
      );
    routes.push(strategy);
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(routes.filter((strategy) => strategy === "NetworkOnly").length, 2);
assert.equal(routes.filter((strategy) => strategy === "CacheFirst").length, 2);
assert.doesNotMatch(
  file,
  /url:"\/(?:api\/|dashboard|settings|rooms|u\/)/,
  "Personalized routes must not enter precache"
);
assert.doesNotMatch(
  file,
  /url:"\/assets\//,
  "Documentation demos and exports must not enter precache"
);
assert.match(
  file,
  /importScripts\([^)]*worker-/,
  "Activation cleanup worker must be imported"
);
console.log(
  "Generated PWA verified: APIs use NetworkOnly; only static/fonts are runtime cached; private pages excluded."
);
