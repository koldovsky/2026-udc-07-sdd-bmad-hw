# Versions / reality-check — `ARCHITECTURE-SPINE.md`

- **Lens:** every committed Stack decision was web-researched or reality-checked (current library/framework versions; named tech still exists and fits; starter defaults only if greenfield). Brownfield: do **not** recommend upgrading. Pins must match `app/package.json` and `app/AGENTS.md`. Latest-on-web being newer is expected and is **not** a fail if the spine explicitly freezes homework ranges.
- **Spine:** `_bmad-output/planning-artifacts/architecture/architecture-2026-udc-07-sdd-bmad-hw-2026-09-02/ARCHITECTURE-SPINE.md` (Stack + freeze footnote + Deferred upgrade line)
- **Context:** BROWNFIELD. Homework stack is frozen. No starter. Engine increment is an in-process TypeScript library under `app/`.
- **Reality-check files (read-only):** `app/package.json`, `app/AGENTS.md`, `app/tsconfig.json`
- **Web check date:** 2026-09-02 (re-verified this review; matches the known check: TypeScript latest **7.0.2**, vitest latest stable **4.1.11**, Node **22** Maintenance LTS)
- **Date:** 2026-09-02

## Gate verdict

**pass.** Every Stack row is a copy of the committed homework ranges, not a training-data “current” claim. Named packages still exist on npm, still fit a NodeNext ESM domain library, and the spine plus Deferred explicitly freeze those ranges. Live majors (TypeScript 7, vitest 4, Node 24 Active LTS) being newer is expected and is not a fail.

No rewrite. Optional freeze-prose polish only (V-3); do not bump pins.

---

## Method

Checked each Stack name against:

1. `app/package.json` (devDependency ranges, `"type": "module"`, no `dependencies`)
2. `app/AGENTS.md` (TypeScript ES2022 / NodeNext, Node 22+, vitest, no runtime deps)
3. `app/tsconfig.json` (`target`/`lib` ES2022, `module`/`moduleResolution` NodeNext, `strict`, `noUncheckedIndexedAccess`, `noEmit`)
4. Live web / registry on 2026-09-02: npm registry (`typescript`, `vitest`, `@types/node`), https://nodejs.org/dist/index.json, Node.js Release README, TypeScript handbook `moduleResolution`

No `app/package-lock.json` exists. Caret resolution is therefore whatever npm installs from the committed ranges (same as the homework files themselves).

Greenfield starter defaults: **N/A** (brownfield; spine correctly names no starter).

---

## Stack row audit

| Spine pin | Homework source | Live (2026-09-02) | Still exists? | Fits this increment? | Verdict |
| --- | --- | --- | --- | --- | --- |
| TypeScript `^5.6.0` | `app/package.json` `devDependencies.typescript` | npm `latest` **7.0.2** (published 2026-07-08). 5.x still published through **5.9.3**. Pin line still installable: **5.6.2 / 5.6.3**. Caret `^5.6.0` resolves to **5.9.3**, not 7.x. | Yes | Yes — `tsc -p tsconfig.json` / NodeNext ESM library. TS 7 is a native Go rewrite without a stable programmatic API; bumping would be out of homework scope. | **Pass** — brownfield freeze, not a stale “current” claim |
| Node.js `22+` | `app/AGENTS.md` “Node 22+” | **22.x Maintenance LTS** “Jod” (latest dist **v22.23.2**, 2026-07-28, `lts: Jod`). Active LTS is **24.x** “Krypton” (v24.20.0). Current is **26.x** (v26.8.1). 22 EOL scheduled **2027-04-30**. | Yes — supported Maintenance LTS | Yes — NodeNext + `"type": "module"` + ES2022 is valid on Node 22. | **Pass** — ratifies AGENTS.md. Newer LTS is not a fail. |
| vitest `^2.1.0` | `app/package.json` `devDependencies.vitest` | npm `latest` stable **4.1.11** (2026-08-18). 5.0.0-rc.4 is prerelease. 2.x still published: **2.1.0 … 2.1.9**. Caret `^2.1.0` stays on 2.x (latest **2.1.9**). | Yes | Yes — colocated `*.test.ts`, `vitest run` / `vitest` scripts, `vitest/globals` in tsconfig. No Vite app/bundler in this increment. | **Pass** |
| `@types/node` `^22.10.0` | `app/package.json` `devDependencies["@types/node"]` | npm `latest` **26.4.1** (Node 26 line). 22-line still published through **22.20.1**. Caret `^22.10.0` stays on 22.x. | Yes | Yes — matches Node 22 types; `tsconfig.types` includes `"node"`. Do not chase `@types/node@26`. | **Pass** — table pin matches package.json |
| ECMAScript target/lib `ES2022` | `app/tsconfig.json` `target` + `lib`; `app/AGENTS.md` | ES2022 remains a valid TypeScript `target`/`lib`. Node 22’s V8 (12.4.x on v22.23.2) covers ES2022. | Yes | Yes | **Pass** |
| `module` / `moduleResolution` `NodeNext` | `app/tsconfig.json`; `app/AGENTS.md` | Still documented (typescriptlang.org `moduleResolution`: `nodenext` for modern Node). Pairing `module` + `moduleResolution` both NodeNext is required. | Yes | Yes — ESM `"type": "module"` + `.js` extensions from `.ts` sources. | **Pass** |
| package type `module` | `app/package.json` `"type": "module"` | Standard Node ESM indicator; still the live default for this pattern. | Yes | Yes with NodeNext | **Pass** |
| runtime dependencies `none` | `app/package.json` has no `dependencies` key; AGENTS.md “No runtime dependencies” | N/A | Yes | Yes — AD-2 in-process pure library; adding runtime packages would contradict the spine. | **Pass** |

Freeze language in the spine (not a Stack row, but the reason live-newer is allowed):

> Pins are the committed `app/package.json` and `app/AGENTS.md` ranges. Do not bump to newer TypeScript or vitest in this increment.

Deferred:

> Upgrading TypeScript ^5.6.0 or vitest ^2.1.0 to later majors — homework stack is frozen.

That is an explicit freeze of the homework ranges. Web-newer is therefore **not** a fail.

---

## Findings

### Critical / high

None.

### V-1 — Live TypeScript is 7.0.2; pin is `^5.6.0` — expected freeze `[ignore]`

**Severity:** info (not a fail)

npm `typescript@latest` is **7.0.2** (native Go compiler, announced 2026). TypeScript 7 turns 6.0 deprecations into hard errors and does not yet ship a stable programmatic API. The spine does **not** claim 5.6 is current. It copies `app/package.json` and forbids bumping.

Within the caret, a fresh `npm install` in `app/` would take **5.9.3** (latest 5.x), not 5.6.3. That is package.json behavior, not spine drift. Frozen range still exists on the registry.

**Action:** ignore. Do not recommend TypeScript 7 (or 6) for this increment.

### V-2 — Live vitest is 4.1.11; pin is `^2.1.0` — expected freeze `[ignore]`

**Severity:** info (not a fail)

npm `vitest@latest` is **4.1.11**. Vitest 5 is RC only. The 2.1.x line is still published (through **2.1.9**). `^2.1.0` does not float to 3.x/4.x. Spine freeze + Deferred majors cover this.

**Action:** ignore. Do not recommend vitest 4.

### V-3 — Freeze sentence names TypeScript and vitest, not `@types/node` or Node `[discuss]` (optional polish)

**Severity:** low

The Stack table pins `@types/node` `^22.10.0` and Node `22+`, matching homework. The freeze footnote and Deferred only say “do not bump TypeScript or vitest / later majors.”

A builder who treats “web latest” as authority could bump `@types/node` to **26.4.1** (npm latest) while leaving TS/vitest frozen. That would still be a homework-range violation even though the table already pins 22.x. Caret `^22.10.0` itself will **not** float to 26; the risk is editing package.json, not install-time resolution.

Node `22+` is the AGENTS.md wording (open-ended above 22). That is ratification, not an invented floor. 22 is still Maintenance LTS through 2027-04-30. Running Node 24/26 under a `22+` floor is allowed by the homework text and is not a spine invention.

**Action:** optional — extend the freeze sentence / Deferred line to “do not bump TypeScript, vitest, `@types/node`, or the Node 22+ floor.” Not required for this lens; pins already match. Do **not** change the version numbers.

### V-4 — Node 22 is Maintenance LTS; Active LTS is 24 — expected homework pin `[ignore]`

**Severity:** info (not a fail)

nodejs.org dist + Release schedule (2026-09-02):

| Line | Status | Latest checked | Notes |
| --- | --- | --- | --- |
| 26.x | Current | v26.8.1 (2026-08-26) | not LTS yet |
| 24.x | Active LTS “Krypton” | v24.20.0 (2026-08-26) | default for *new* work in 2026 |
| 22.x | Maintenance LTS “Jod” | v22.23.2 (2026-07-28) | spine / AGENTS.md pin; EOL 2027-04-30 |

Node 22 still exists, still receives LTS maintenance, and still fits ES2022 + NodeNext + ESM. Recommending Node 24 would violate the brownfield freeze.

**Action:** ignore.

### V-5 — Compiler-option rows are project-checked, not npm packages `[ignore]`

**Severity:** info

`ES2022`, `NodeNext`, `package type: module`, and `runtime dependencies: none` are not versioned npm artifacts. They were confirmed against `app/tsconfig.json` and `app/package.json`, and against current TypeScript docs (`nodenext` still the Node ESM pairing). No invented bundler, test runner, or runtime library.

`app/tsconfig.json` also sets `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`, and `types: ["node", "vitest/globals"]`. Those are existing project flags, not unnamed Stack products. Omitting them from the Stack table is correct seed altitude.

**Action:** ignore.

---

## What was *not* found

- No Stack name that does not exist (no yanked packages, no fictional frameworks).
- No Stack row that contradicts `app/package.json` / `app/AGENTS.md` / `app/tsconfig.json`.
- No claim that the homework pins are “latest.”
- No greenfield starter whose live defaults were skipped (there is no starter).
- No recommendation in this review to upgrade. Pins should stay as written.

---

## Disposition

| ID | Autofix / discuss / defer / ignore |
| --- | --- |
| V-1 TS 7 vs `^5.6.0` | ignore |
| V-2 vitest 4 vs `^2.1.0` | ignore |
| V-3 freeze prose omits `@types/node` / Node | discuss (optional one-line freeze widening; do not change pins) |
| V-4 Node 22 Maintenance vs 24 Active | ignore |
| V-5 compiler-option rows | ignore |

**Spine change required for this lens:** none.
