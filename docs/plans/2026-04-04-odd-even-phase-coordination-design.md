# Odd-Even Phase Coordination Design

**Date:** 2026-04-04  
**Status:** Approved  
**Owners:** Primary agent (odd phases), secondary agent (even phases)

## 1. Goal

Execute project phases in parallel with minimal integration risk by assigning odd phases to one agent and even phases to another, while maintaining shared interface compatibility.

## 2. Chosen Approach

**Selected:** Contract-First Parallel

### Ownership
- Primary agent: phases `1, 3, 5, 7`
- Secondary agent: phases `2, 4, 6`

### Baseline Contract Source
- `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md`

### Sync Checkpoints
- Checkpoint A: after phases `1 + 2`
- Checkpoint B: after phases `3 + 4`
- Checkpoint C: after phases `5 + 6`
- Final integration validation: after phase `7`

### Artifacts

- [Contract Ledger](../superpowers/contracts/2026-04-04-odd-even-contract-ledger.md)
- [Checkpoint Log](../superpowers/contracts/2026-04-04-odd-even-checkpoint-log.md)

## 3. Component Boundaries

### Stable Contract Surface
- Shared types and protocol shapes defined in the MVP spec.
- Any cross-phase interface changes must be documented before checkpoint reconciliation.

### Phase-Owned Implementation Surface
- Each agent can iterate quickly within its owned phase documents and implementation scope.
- Contract-breaking changes are blocked until explicitly reconciled at a checkpoint.

### Contract Ledger
- Path: `docs/superpowers/contracts/2026-04-04-odd-even-contract-ledger.md`
- Purpose: single source of truth for interface deltas between checkpoints.

## 4. Data Flow

1. Both agents start from the same baseline spec.
2. Each agent executes its assigned phase work in parallel.
3. Any interface change is recorded in the contract ledger immediately.
4. At each checkpoint, ledger entries are reconciled before next-phase execution.

## 5. Error Handling Rules

- Missing ledger entry for a contract change: **blocker**.
- Naming/docs drift without semantic break: fix during current checkpoint.
- Ownership conflicts: phase owner decides implementation details; shared contract remains spec-driven.

## 6. Test Gates

### Per-Phase Gate
- Run local typecheck/lint/tests for changed scope.

### Per-Checkpoint Gate
- Run integration smoke tests across both agents' phase outputs.

### Final Gate
- Run full regression after phase `7` and prior to merge.

## 7. Success Criteria

- Odd and even phase outputs integrate at each checkpoint without unresolved contract deltas.
- No untracked contract-breaking changes reach subsequent phases.
- Final regression passes with merged odd/even outputs.

