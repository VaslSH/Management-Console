# AGENTS.md

Vasl Media Server management console. Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI.

The console talks to the media server with client fetches to `/rest/v2`. Session state is in `localStorage`. Passwords are MD5-hashed with `spark-md5` before they are sent.

## Where code lives

```
src/app/                  routes
src/features/console/     screens and the shell
src/components/ui/        button, dialog, dropdown-menu, input, switch, sonner
src/components/icons.tsx  the only icon import site for console code
src/components/themes/    Vasl theme provider
src/lib/api.ts            REST client
src/lib/session.ts        session and access scope
src/lib/password.ts       MD5 hash
src/styles/themes/vasl.css
packages/starter/         archived starter, excluded from tsc and oxlint
```

`packages/starter` keeps the old products, users, and overview features, data tables, forms, kbar, extra themes, and the old sidebar. It is not a workspace and the console must not import it. To use a piece, copy the file back into `src/` at the same relative path and add the dependency it imports. Versions are listed in `packages/starter/package.json`. Details are in `packages/starter/README.md`.

## Commands

```bash
bun run dev
bun run build          # BUILD_STATIC=true next build
bun run typecheck
bun run lint
```

## Conventions

- Server components by default. Add `'use client'` only for hooks or browser APIs.
- Console data fetching stays in the client. Do not prefetch the media API from a server component, and do not read cookies in layouts.
- Use `cn()` from `@/lib/utils` for class names.
- Icons: import `Icons` from `@/components/icons`. Register a new icon there. Do not import `@tabler/icons-react` from console code. Do not hand-edit `src/components/ui/` to restyle shadcn primitives.
- Formatting: single quotes, JSX single quotes, no trailing comma, 2-space indent.
- App URLs use a trailing slash (`/applications/?name=LiveApp`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
