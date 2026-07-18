# 🐶 Husky Troubleshooting Reference Manual (GSSoC Contributors)

This guide helps GSSoC contributors resolve common Husky and Git hook issues encountered during local development on DevTrack.

---

## 📋 Table of Contents

1. [What is Husky?](#what-is-husky)
2. [Common Errors & Fixes](#common-errors--fixes)
3. [Pre-commit Hook Failures](#pre-commit-hook-failures)
4. [Pre-push Hook Failures](#pre-push-hook-failures)
5. [Husky Not Running At All](#husky-not-running-at-all)
6. [Windows-Specific Issues](#windows-specific-issues)
7. [Nuclear Reset](#nuclear-reset)
8. [Quick Reference](#quick-reference)

---

## What is Husky?

Husky is a tool that runs scripts automatically before Git actions like `commit` and `push`. DevTrack uses Husky to enforce:

- **ESLint** checks before every commit
- **TypeScript** type checking before push
- **Prettier** formatting validation

This ensures all code merged into `main` meets quality standards.

---

## Common Errors & Fixes

### ❌ Error: `husky: command not found`

**Cause:** Dependencies not installed or Husky not initialized.

**Fix:**
```bash
pnpm install
pnpm prepare
```

---

### ❌ Error: `.husky/pre-commit: Permission denied`

**Cause:** Hook scripts are not executable (common on Linux/macOS).

**Fix:**
```bash
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
```

---

### ❌ Error: `cannot run .husky/pre-commit: No such file or directory`

**Cause:** Husky hooks were not generated after install.

**Fix:**
```bash
pnpm install
npx husky install
```

---

### ❌ Error: `husky - Pre-commit hook exited with code 1`

**Cause:** ESLint or Prettier found errors in your code.

**Fix:**
```bash
# Auto-fix lint errors
pnpm run lint -- --fix

# Auto-fix formatting
pnpm run format

# Then try committing again
git add .
git commit -m "your message"
```

---

### ❌ Error: `Type error: ...` on pre-push

**Cause:** TypeScript type check failed before push.

**Fix:**
```bash
pnpm run type-check
```

Fix all type errors shown, then push again.

---

## Pre-commit Hook Failures

Pre-commit runs **ESLint + Prettier** on staged files.

### Step-by-step fix:

```bash
# 1. Check what errors exist
pnpm run lint

# 2. Auto-fix what's possible
pnpm run lint -- --fix

# 3. Check formatting
pnpm run format

# 4. Stage fixes
git add .

# 5. Commit again
git commit -m "fix: resolve lint errors"
```

---

## Pre-push Hook Failures

Pre-push runs **TypeScript type checking**.

### Step-by-step fix:

```bash
# 1. Run type check locally
pnpm run type-check

# 2. Fix all errors shown in terminal

# 3. Push again
git push origin your-branch
```

---

## Husky Not Running At All

If Husky hooks are completely silent (no output on commit):

```bash
# Reinstall husky
pnpm install

# Reinitialize hooks
npx husky install

# Verify hooks exist
ls .husky/
```

You should see `pre-commit` and `pre-push` files.

---

## Windows-Specific Issues

### ❌ Error: `pnpm: command not found` in Git Bash

**Fix:** Use PowerShell or CMD instead of Git Bash for pnpm commands.

---

### ❌ Error: `\r: command not found` (line ending issue)

**Cause:** Windows CRLF line endings in hook files.

**Fix:**
```bash
git config --global core.autocrlf false
```

Then reinstall:
```bash
pnpm install
npx husky install
```

---

### ❌ Husky hooks not running in VS Code terminal

**Fix:** Restart VS Code after running `pnpm install`.

---

## Nuclear Reset

If nothing works, do a complete reset:

```bash
# 1. Remove node_modules and reinstall
rm -rf node_modules
pnpm install

# 2. Reinitialize Husky
npx husky install

# 3. Make hooks executable (Linux/macOS)
chmod +x .husky/*

# 4. Test with a commit
git add .
git commit -m "test: verify husky working"
```

---

## Quick Reference

| Problem | Command |
|---|---|
| Husky not found | `pnpm install && pnpm prepare` |
| Permission denied | `chmod +x .husky/pre-commit` |
| Lint errors | `pnpm run lint -- --fix` |
| Format errors | `pnpm run format` |
| Type errors | `pnpm run type-check` |
| Windows line endings | `git config --global core.autocrlf false` |
| Full reset | `rm -rf node_modules && pnpm install && npx husky install` |

---

## Still Stuck?

- Check [CONTRIBUTING.md](../CONTRIBUTING.md) for setup guide
- Open a [GitHub Discussion](https://github.com/Priyanshu-byte-coder/devtrack/discussions)
- Ask in the GSSoC Discord community

---

*This document is maintained for GSSoC 2026 contributors.*