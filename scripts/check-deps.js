/**
 * Checks that every third-party import in src/ has a matching entry
 * in package.json dependencies or devDependencies.
 *
 * Catches issues like: import jsPDF from 'jspdf' with no jspdf in package.json.
 */

const fs = require("fs");
const path = require("path");
const { builtinModules } = require("module");

// Node built-ins (not in package.json but valid to import)
const BUILTINS = new Set(builtinModules);

// Next.js / framework aliases that resolve internally
const FRAMEWORK_ALIASES = new Set([
  "next", "react", "react-dom",
  "server-only", "client-only",
]);
const packageMetadataCache = new Map();

function collectFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", ".git", "build", "coverage", "out"].includes(entry.name)) continue;
      out.push(...collectFiles(full));
    } else if (/\.(js|jsx|mjs|cjs|ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function extractPackageName(mod) {
  if (mod.startsWith("@")) {
    // scoped: @org/pkg/sub → @org/pkg
    const parts = mod.split("/");
    return parts.slice(0, 2).join("/");
  }
  return mod.split("/")[0];
}

const IMPORT_RE = /^\s*(?:import|export)\s[^'"]*from\s+['"]([^'"]+)['"]/gm;
const SIDE_EFFECT_IMPORT_RE = /^\s*import\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_RE = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractImports(src) {
  const imports = [];

  // Strip single-line and multi-line comments to prevent quotes inside comments from throwing off the regex
  const cleanSrc = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  for (const re of [IMPORT_RE, SIDE_EFFECT_IMPORT_RE, DYNAMIC_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(cleanSrc)) !== null) {
      imports.push(m[1]);
    }
  }

  return imports;
}
function loadConfigWithExtends(configPath) {
  const config = JSON.parse(
    fs.readFileSync(configPath, "utf8")
  );

  if (!config.extends) {
    return config;
  }

  const parentPath = path.resolve(
    path.dirname(configPath),
    config.extends
  );

  if (!fs.existsSync(parentPath)) {
    return config;
  }

  const parentConfig =
    loadConfigWithExtends(parentPath);

  return {
    ...parentConfig,
    ...config,
    compilerOptions: {
      ...(parentConfig.compilerOptions || {}),
      ...(config.compilerOptions || {}),
      paths: {
        ...(parentConfig.compilerOptions?.paths || {}),
        ...(config.compilerOptions?.paths || {}),
      },
    },
  };
}
function loadInternalAliases(rootDir) {
  const aliases = ["@/", "~/", "src/"];

  const configFiles = ["tsconfig.json", "jsconfig.json"];

  for (const file of configFiles) {
    const configPath = path.join(rootDir, file);

    if (!fs.existsSync(configPath)) continue;

    try {
      const config =
        loadConfigWithExtends(configPath);

      const paths = config.compilerOptions?.paths || {};

      for (const key of Object.keys(paths)) {
        aliases.push(
          key.replace(/\*.*$/, "")
        );
      }
    } catch (err) {
      console.warn(
        `Warning: Failed to parse ${file}`
      );
    }
  }

  return aliases;
}
function isValidPackageSubpath(pkgName, mod, cwd) {
  try {
    let pkgJson;

    if (packageMetadataCache.has(pkgName)) {
      pkgJson = packageMetadataCache.get(pkgName);
    } else {
      const pkgJsonPath = require.resolve(
        `${pkgName}/package.json`,
        { paths: [cwd] }
      );

      pkgJson = JSON.parse(
        fs.readFileSync(pkgJsonPath, "utf8")
      );

      packageMetadataCache.set(pkgName, pkgJson);
    }

    const exportsField = pkgJson.exports;

    if (!exportsField) return true;

    const subpath = mod.slice(pkgName.length);

    if (!subpath) return true;

    const exportKey =
      "." + (subpath.startsWith("/") ? subpath : "/" + subpath);

    if (typeof exportsField === "string") {
      return exportKey === ".";
    }

    return (
      exportKey in exportsField ||
      "./*" in exportsField
    );
  } catch {
    return true;
  }
}
function collectMissingDeps(files, allDeps, cwd = process.cwd()) {
  const missing = new Map(); // pkgName → Set of files
  // Load Aliases 
  const INTERNAL_ALIASES = loadInternalAliases(cwd);

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(cwd, file).replace(/\\/g, "/");

    for (const mod of extractImports(src)) {
      if (
        mod.startsWith(".") || 
        mod.startsWith("/") || 
        INTERNAL_ALIASES.some(alias => mod.startsWith(alias))
      ) {
        continue;
      }
      const pkgName = extractPackageName(mod);

      const normalizedPkg = pkgName.startsWith("node:")
        ? pkgName.slice(5)
        : pkgName;

      if (
        BUILTINS.has(normalizedPkg) ||
        FRAMEWORK_ALIASES.has(normalizedPkg)
      ) {
        continue;
      }
      if (allDeps.has(pkgName)) {
        if (
          mod !== pkgName &&
          !isValidPackageSubpath(pkgName, mod, cwd)
      ) {
        if (!missing.has(mod)) {
          missing.set(mod, new Set());
        }

        missing.get(mod).add(rel);
      }

       continue;
     }

      if (!missing.has(pkgName)) missing.set(pkgName, new Set());
      missing.get(pkgName).add(rel);
    }
  }

  return missing;
}

function main() {
  const pkgPath = path.resolve(__dirname, "../package.json");
  const srcDir = path.resolve(__dirname, "../src");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const allDeps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);

  const files = collectFiles(srcDir);
  const missing = collectMissingDeps(files, allDeps, path.resolve(__dirname, ".."));

  if (missing.size > 0) {
    console.error("\n❌  Imports found with no matching entry in package.json:\n");
    for (const [pkg, usedIn] of missing) {
      console.error(`  ${pkg}`);
      for (const f of usedIn) console.error(`    └─ ${f}`);
    }
    console.error("\nFix: npm install <package-name>  then commit package.json + package-lock.json\n");
    process.exit(1);
  }

  console.log(`✓  All imports accounted for (${files.length} files checked)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  collectMissingDeps,
  extractImports,
  extractPackageName,
};
