---
paths:
  - "src/gateway/**/*.ts"
  - "src/website/**/*.ts"
  - "src/website/**/*.tsx"
---

# TypeScript Rules

- Strict mode on; no `any` unless wrapping an external lib with no types
- `zod` for runtime validation at API boundaries
- WebSocket messages: always parse with a schema before using fields
- `dotenv` loaded in entry point only — don't `require('dotenv')` in library files
- Error responses: always return `{ error: string }` JSON, never raw stack traces
- Next.js: server components by default, `"use client"` only when using hooks/events
