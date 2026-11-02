const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
function installed(name) {
  const location = path.resolve("node_modules/.pnpm/node_modules", name);
  assert.ok(fs.existsSync(location), `${name} must be installed by pnpm`);
  return location;
}
function verifyPatches() {
  const manifest = JSON.parse(fs.readFileSync("patches/security.json", "utf8"));
  for (const item of manifest) {
    assert.equal(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(item.patch))
        .digest("hex"),
      item.sha256,
      `${item.package}: reviewed patch hash changed`
    );
    const module = installed(item.package);
    assert.equal(require(module + "/package.json").version, item.version);
    if (item.package === "braces") {
      const braces = require(module);
      assert.deepEqual(braces.expand("x{a,b}"), ["xa", "xb"]);
      const deeplyNested = "{".repeat(1000) + "a,b" + "}".repeat(1000);
      for (const operation of [braces.parse, braces.compile, braces.expand])
        assert.throws(() => operation(deeplyNested), /safe complexity/);
      let deepAst = { type: "text", value: "x" };
      for (let i = 0; i < 100; i++)
        deepAst = { type: "root", nodes: [deepAst] };
      for (const operation of [braces.compile, braces.expand, braces.stringify])
        assert.throws(() => operation(deepAst), /safe complexity/);
      const ast = { type: "root", nodes: [] };
      ast.nodes.push(ast);
      assert.throws(() => braces.compile(ast), /safe complexity/);
    } else if (item.package === "deepmerge") {
      // GHSA-gcqx-w48m-w2h4: mergeObject() assigned with `destination[key] =`,
      // so a source key of "__proto__" hit the prototype setter and poisoned
      // the returned object. The patch assigns via Object.defineProperty.
      for (const file of ["dist/cjs.js", "dist/umd.js"]) {
        const deepmerge = require(module + "/" + file);
        const payload = () => JSON.parse('{"__proto__":{"polluted":"yes"}}');

        // A null-prototype target is the reachable vector: "__proto__" is not
        // on the target, so the existing propertyIsUnsafe() guard lets it past.
        const bare = Object.create(null);
        bare.a = 1;
        const merged = deepmerge(bare, payload());
        assert.equal(Object.getPrototypeOf(merged), Object.prototype);
        assert.equal(merged.polluted, undefined);
        assert.ok(Object.prototype.hasOwnProperty.call(merged, "__proto__"));

        // Same vector one level down.
        const nested = deepmerge({ cfg: Object.create(null) }, { cfg: payload() });
        assert.equal(Object.getPrototypeOf(nested.cfg), Object.prototype);
        assert.equal(nested.cfg.polluted, undefined);

        // Nothing leaks to the global prototype.
        assert.equal({}.polluted, undefined);

        // Ordinary merging is unchanged.
        assert.deepEqual(deepmerge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 }), {
          a: 1,
          b: { c: 2, d: 3 },
          e: 4,
        });
        assert.deepEqual(deepmerge([1, 2], [3]), [1, 2, 3]);
        assert.deepEqual(Object.keys(deepmerge({ a: 1 }, payload())), ["a"]);
        const symbol = Symbol("copied");
        assert.equal(deepmerge({}, { [symbol]: "v" })[symbol], "v");
      }
    } else {
      for (const file of ["src/sprintf.js", "dist/sprintf.min.js"]) {
        const { sprintf } = require(module + "/" + file);
        assert.equal(sprintf("hello %s %04d", "world", 3), "hello world 0003");
        assert.throws(() => sprintf("%1000000000s", "x"), /safe size/);
        assert.throws(() => sprintf("%.1000000000f", 1), /safe size/);
      }
    }
  }
  return manifest;
}
module.exports = { verifyPatches };
if (require.main === module) {
  verifyPatches();
  console.log("Dependency patch regression checks passed.");
}
