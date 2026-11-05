# CLAUDE.md

Vasl Media Server management console. Next.js 16, React 19, Tailwind v4, shadcn/ui.

## Key References

- **[AGENTS.md](./AGENTS.md)** — Console map, conventions, and how the starter library is separated
- **[packages/starter/README.md](./packages/starter/README.md)** — Archived dashboard starter and how to copy a piece back
- **[docs/deployment.md](./docs/deployment.md)** — Deployment

Form and theme notes for the archived starter are in `packages/starter/docs/`.

## Critical Conventions

- **Data** — client `api()` in `src/lib/api.ts` against `/rest/v2` with `credentials: 'include'`. No server prefetch and no route handlers for the console API. Passwords are MD5-hashed before send.
- **Icons** — only import from `@/components/icons`, never from `@tabler/icons-react` directly. shadcn files under `src/components/ui/` may import tabler themselves; do not hand-edit those files to change that.
- **Pages** — console screens live in `src/features/console` and are wrapped by `Shell`. Do not import `packages/starter`.
- **Formatting** — single quotes, JSX single quotes, no trailing comma, 2-space indent
