# ESLint Warning Burndown — Plan (prompt 02)

## 0. Ground truth (real, from `npx eslint . --format json`, excluding engine files)

**Total violations in authored code: 61** across 54 files.

### By rule (sorted by count)
| Rule | Violations | Files |
|------|-----------|-------|
| `quality/no-direct-console` | 28 | 7 |
| `@typescript-eslint/no-explicit-any` | 13 | 6 |
| `@typescript-eslint/no-unused-vars` | 10 | 7 |
| `no-undef` | 6 | 4 |
| `@typescript-eslint/no-require-imports` | 3 | 3 |
| `import-x/no-unresolved` | 1 | 1 |

### Top files by violation count
- `tools/content-sync/src/importer.ts` — 8 (console + any)
- `tools/content-sync/src/cli.ts` — 6 (console)
- `tools/content-sync/src/watcher.ts` — 4 (console + unresolved import)
- `apps/server/src/modules/character/character.controller.ts` — 3 (console + any)
- `tools/content-sync/src/validator.ts` — 3 (console)
- `verify.mjs` — 3 (console)
- `apps/server/src/infra/redis.ts` — 1 (console)
- `apps/server/src/modules/auth/auth.service.ts` — 3 (unused vars)
- `apps/server/src/modules/character/character.service.ts` — 4 (any)
- `packages/content-schema/src/lib/formula.ts` — 3 (any)

## 1. 🔴 Decision gate

**Riskiest rule: `@typescript-eslint/no-explicit-any`** (13 violations, 6 files)

Why it's the riskiest:
- Concentrated in **critical infrastructure**: auth service, character service, content service, formula evaluator.
- Fixing it requires adding proper TypeScript types, which can silently change inferred return types and break callers.
- Some `any` types may be intentional (e.g., formula context objects, JSON payloads from RM MV, database JSONB columns).
- A wrong fix here can break auth, character creation, or battle formulas — production-critical paths.

**Options:**
- **(A) Fix every violation fully.** Add precise types everywhere. Default if no response.
- **(B) Fix most, track the rest as debt.** Fix the cheap ones (e.g., `any` in controllers/CLI tools); leave the expensive ones in services with explicit `// eslint-disable` comments + issue references.
- **(C) Re-scope or loosen the rule.** ⚠️ Change config to allow `any` in specific files/patterns. This is a config change, not a code fix.

Everything outside this rule proceeds regardless of the choice.

## 2. Success criteria
- `npm run lint` shows 0 warnings for the rules we target
- `npm run typecheck` clean
- `npm test` green
- `npm run build` succeeds
- Zero behavior change (only mechanical type additions, console replacements, unused-var removals)

## 3. Waves

### Wave 1 — Trivial mechanical fixes (no behavior change)
1. `@typescript-eslint/no-unused-vars` — remove unused imports/vars in 7 files
2. `no-undef` + `@typescript-eslint/no-require-imports` in CJS files — add proper ESLint env/config for CommonJS
3. `import-x/no-unresolved` in watcher.ts — fix lodash import path

### Wave 2 — Console replacement (after creating minimal logger)
4. `quality/no-direct-console` — replace `console.*` with logger calls in authored code

### Wave 3 — Explicit any (depends on decision gate)
5. `@typescript-eslint/no-explicit-any` — add types per decision gate choice

## 4. Pitfalls
- **CJS files**: `eslint-rules/*.cjs` and `verify.mjs` use `require`/`module` globals. `no-undef` and `no-require-imports` will fire unless we set `languageOptions.ecmaVersion`/`sourceType` or add `/* eslint-env node */` comments.
- **verify.mjs**: temporary file, should be deleted after step 5 of prompt 08 (or kept as a script). It has console.log calls.
- **Formula evaluator**: `formula.ts` uses `any` for the isolated-vm context. Changing this to a proper interface must preserve the sandbox contract.
- **Content sync CLI**: `tools/content-sync/src/*.ts` are Node.js CLI scripts, not browser code. They legitimately use console for CLI output. We may need a logger wrapper or adjust the rule's `allow` list for these files.
- **JSONB columns**: `character.service.ts` and `content.service.ts` store/load JSONB. The `any` types here are often unavoidable without a shared schema type. Adding `unknown` instead of `any` might be the right compromise.

## 5. Reviewer sign-off
- **Wave 1**: No domain risk (mechanical). Language reviewer: TypeScript/ESLint.
- **Wave 2**: Needs infra reviewer (logger exists?). Language reviewer: TypeScript.
- **Wave 3**: Needs domain-risk reviewer for auth/character/content/formula changes. Language reviewer: TypeScript.

## 6. Final checklist
- [ ] `npm run lint` shows 0 warnings for target rules
- [ ] `npm run typecheck` clean
- [ ] `npm test` green
- [ ] `npm run build` succeeds
- [ ] Every suppression listed with justification (or empty list)

**Decision gate question:** For `@typescript-eslint/no-explicit-any` (13 violations, 6 files, including critical auth/character/content/formula paths), do you choose **(A) fix all**, **(B) fix most + track debt**, or **(C) loosen the rule**?

I'll proceed with **Option A as default** while waiting for your answer, starting with Wave 1 (mechanical fixes that are safe regardless).
