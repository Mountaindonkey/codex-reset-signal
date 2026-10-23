# Uncertain Tibo Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forward possible timing/quota/rollout announcements verbatim instead of dropping posts without `reset`.

**Architecture:** Add an uncertain fallback to the existing event extractor; reuse existing delivery, persistence, and deduplication. Keep confirmed event parsing separate.

**Tech Stack:** Existing TypeScript, Node.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-uncertain-alerts-design.md`

## Global Constraints

- No model service, extra credentials, or dependency changes.
- Preserve original post text and URL; never claim a timing-only post confirms a reset.
- Keep bootstrap suppression and the INCLUDE_MENTIONS opt-out.

## Review Focus

- Timing-only replies must reach an email adapter.
- English and Chinese time expressions should produce uncertain alerts.
- A quota/restoration hint without `reset` should be forwarded.
- Repeated polling must not send the same post twice.
- Existing confirmed events and unrelated-post filtering must retain their behavior.

### Task 1: Widen uncertain alerts

**Files:** `src/events.ts`, `src/notifications.ts`, `tests/uncertain-alerts.test.ts`, `README.zh-CN.md`.

- [x] Add regression cases for the real timing-only reply, natural timing/quota hints, unrelated posts, delivery text/URL, opt-out, bootstrap suppression, and deduplication.
- [x] Run the new tests and confirm the timing-only cases fail on existing code (12 failed assertions before implementation).
- [x] Add the broad fallback and an explicit uncertain-forwarding label.
- [x] Run the new tests, full `npm test` (103 passed), `npm run typecheck`, and `npm run build` (completed with existing dashboard sourcemap/bundling warnings).
- [ ] Review the diff, commit, publish to the user's fork, and verify the deployed code. If credentials block writing, retain a complete tested patch and identify the exact access limitation.
