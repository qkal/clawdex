# Odd-Phase (1-3-5-7) Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Execute phases 1, 3, 5, and 7 in parallel with another agent handling phases 2, 4, and 6, while preserving contract compatibility at each checkpoint.

**Architecture:** Use contract-first parallel delivery. Odd and even phase work proceeds independently between checkpoints, but shared contracts (types, protocol shape, config interfaces) are reconciled before either side continues. Every checkpoint includes integration verification and a short written reconciliation note.

**Tech Stack:** TypeScript, Bun, pnpm workspaces, existing phase docs under `docs/superpowers/plans/`, git, Markdown docs

---

## Skill References
- `@superpowers:executing-plans`
- `@superpowers:subagent-driven-development`
- `@superpowers:verification-before-completion`
- `@superpowers:requesting-code-review`

### Task 1: Bootstrap Coordination Artifacts

**Files:**
- Create: `docs/superpowers/contracts/2026-04-04-odd-even-contract-ledger.md`
- Create: `docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md`
- Modify: `docs/plans/2026-04-04-odd-even-phase-coordination-design.md`

**Step 1: Create contract ledger skeleton**

```md
# Odd-Even Contract Ledger

## Baseline
- Spec: docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md

## Delta Entries
- Date:
- Checkpoint:
- Owner:
- Interface Changed:
- Backward Compatible: yes/no
- Required Follow-Up:
```

**Step 2: Create checkpoint log skeleton**

```md
# Odd-Even Checkpoint Log

## Checkpoint A (Phases 1+2)
- Odd status:
- Even status:
- Integration result:
- Blockers:

## Checkpoint B (Phases 3+4)
## Checkpoint C (Phases 5+6)
## Final (after Phase 7)
```

**Step 3: Link new artifacts from the design doc**

Add a short "Artifacts" section in the coordination design with both file paths.

**Step 4: Verify files exist and contain required section headers**

Run: `rg "^## Checkpoint A|^## Delta Entries" docs/superpowers/contracts`
Expected: two matches, one for checkpoint log and one for contract ledger

**Step 5: Commit**

```bash
git add docs/superpowers/contracts/2026-04-04-odd-even-contract-ledger.md docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md docs/plans/2026-04-04-odd-even-phase-coordination-design.md
git commit -m "docs: add odd-even contract ledger and checkpoint log"
```

### Task 2: Execute Phase 1 (Foundation) to Completion

**Files:**
- Modify: `docs/superpowers/plans/2026-04-04-phase1-foundation.md`
- Create/Modify: files listed inside Phase 1 plan (root workspace + `packages/shared-types`, `packages/config`, `packages/auth`, `packages/testkit`)

**Step 1: Read phase plan and extract first unchecked step**

Run: `rg "^- \[ \]" docs/superpowers/plans/2026-04-04-phase1-foundation.md`
Expected: list of unchecked phase steps

**Step 2: Execute exactly one unchecked implementation step (TDD-first where phase doc defines tests)**

If the step defines a test first, write the failing test before implementation.

**Step 3: Run only the smallest relevant verification command**

Run one of:
- `bun test <targeted-test>`
- `pnpm -r run typecheck --filter <package>`
- `pnpm -r run lint --filter <package>`
Expected: command passes for changed scope

**Step 4: Mark that single step complete in phase doc**

Update exactly one checkbox from `[ ]` to `[x]`.

**Step 5: Commit one logical unit**

```bash
git add <changed-files>
git commit -m "feat(phase1): <single completed step>"
```

**Step 6: Repeat Steps 2-5 until no unchecked items remain in Phase 1**

Completion check:
Run: `rg "^- \[ \]" docs/superpowers/plans/2026-04-04-phase1-foundation.md`
Expected: no output

### Task 3: Checkpoint A Reconciliation (Phases 1+2)

**Files:**
- Modify: `docs/superpowers/contracts/2026-04-04-odd-even-contract-ledger.md`
- Modify: `docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md`

**Step 1: Diff odd-phase output against shared contract surfaces**

Run: `git diff --name-only HEAD~20..HEAD`
Expected: list includes phase 1 outputs

**Step 2: Record all contract-relevant deltas in ledger**

For each changed interface, add one ledger entry.

**Step 3: Reconcile against even agent changes and note outcome**

Document: compatible / requires adapter / blocked.

**Step 4: Run checkpoint integration gate**

Run: `pnpm -r run typecheck && pnpm -r run test`
Expected: no cross-phase breakage

**Step 5: Commit checkpoint notes (docs-only commit)**

```bash
git add docs/superpowers/contracts/2026-04-04-odd-even-contract-ledger.md docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md
git commit -m "docs: record checkpoint A contract reconciliation"
```

### Task 4: Execute Phase 3 (Core Engine)

**Files:**
- Modify: `docs/superpowers/plans/2026-04-04-phase3-core-engine.md`
- Create/Modify: files listed inside Phase 3 plan

**Step 1: Repeat Task 2 pattern for Phase 3 until all checkboxes are complete**

Run after each micro-step:
- targeted tests first
- then package-level typecheck/lint

**Step 2: Verify Phase 3 checklist completion**

Run: `rg "^- \[ \]" docs/superpowers/plans/2026-04-04-phase3-core-engine.md`
Expected: no output

### Task 5: Checkpoint B Reconciliation (Phases 3+4)

**Files:**
- Modify: `docs/superpowers/contracts/2026-04-04-odd-even-contract-ledger.md`
- Modify: `docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md`

**Step 1: Record new deltas from Phase 3 changes**
**Step 2: Reconcile with even-phase (Phase 4) outputs**
**Step 3: Run integration gate (`pnpm -r run typecheck && pnpm -r run test`)**
**Step 4: Commit checkpoint notes**

### Task 6: Execute Phase 5 (CLI Integration)

**Files:**
- Modify: `docs/superpowers/plans/2026-04-04-phase5-cli-integration.md`
- Create/Modify: files listed inside Phase 5 plan

**Step 1: Repeat Task 2 pattern for Phase 5 until all checkboxes are complete**
**Step 2: Verify no unchecked phase items remain**

Run: `rg "^- \[ \]" docs/superpowers/plans/2026-04-04-phase5-cli-integration.md`
Expected: no output

### Task 7: Checkpoint C Reconciliation (Phases 5+6)

**Files:**
- Modify: `docs/superpowers/contracts/2026-04-04-odd-even-contract-ledger.md`
- Modify: `docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md`

**Step 1: Record contract deltas from Phase 5**
**Step 2: Reconcile with even-phase (Phase 6) output**
**Step 3: Run integration gate**
**Step 4: Commit checkpoint notes**

### Task 8: Execute Phase 7 (MCP + Skills)

**Files:**
- Modify: `docs/superpowers/plans/2026-04-04-phase7-mcp-skills.md`
- Create/Modify: files listed inside Phase 7 plan

**Step 1: Repeat Task 2 pattern for Phase 7 until all checkboxes are complete**
**Step 2: Verify no unchecked phase items remain**

Run: `rg "^- \[ \]" docs/superpowers/plans/2026-04-04-phase7-mcp-skills.md`
Expected: no output

### Task 9: Final Integration + Readiness

**Files:**
- Modify: `docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md`
- Modify: `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md` (only if approved contract updates are required)

**Step 1: Final regression run**

Run: `pnpm -r run typecheck && pnpm -r run lint && pnpm -r run test`
Expected: all pass

**Step 2: Record final integration status in checkpoint log**

Document: pass/fail, unresolved risks, and next actions.

**Step 3: Request code review before merge**

Use `@superpowers:requesting-code-review` process.

**Step 4: Commit final reconciliation docs**

```bash
git add docs/superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md
git commit -m "docs: record final odd-even integration readiness"
```