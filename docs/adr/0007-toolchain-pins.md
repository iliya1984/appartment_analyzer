# 0007 — Toolchain version pins

**Context.** As of 2026-11, TypeScript 7 and ESLint 10 are out, but `typescript-eslint` supports
TypeScript < 6.1, and `eslint-plugin-jsx-a11y` / `eslint-plugin-import` support ESLint ≤ 9.

**Decision.** Pin TypeScript `~6.0` and ESLint `^9` so type-aware linting, accessibility linting
and import rules all work together.

**Consequences.** npm warns that ESLint 9 is out of support. Revisit when those plugins support
ESLint 10 and `typescript-eslint` supports TypeScript 7.
