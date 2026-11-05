# Starter library

This folder is the unused part of the Next.js dashboard starter the console was built from. It is source you can copy back later. It is not installed, not published, and the console does not import it.

`tsconfig.json` excludes this folder, and oxlint ignores it, so a missing dependency here does not fail the console build.

## What is here

Paths match the old `src/` layout, so a file can move straight back:

- `src/features/products`, `src/features/users`, `src/features/overview`
- `src/components/ui` primitives the console does not use, plus data tables, forms, kbar, and the old sidebar layout
- `src/styles/themes` for the extra color themes
- `src/components/themes/theme.config.ts` with the full theme list
- `docs/forms.md` and `docs/themes.md`
- `scripts/cleanup.js` and `scripts/cleanup-templates`

The console keeps its own copies of button, dialog, dropdown menu, input, switch, sonner, the Vasl theme, and `src/features/console`.

## Copy a piece back

1. Copy the file from `packages/starter/src/...` to `src/...`, keeping the same path.
2. Copy any local files it imports the same way.
3. Add the packages that file imports to the root `package.json`. The versions are listed in this folder's `package.json`. The console already has Next.js, React, Base UI, Tailwind, and the icon package.
4. If you copy a theme, also copy its CSS file into `src/styles/themes/` and add the `@import` in `src/styles/theme.css`. Add the theme entry back to `src/components/themes/theme.config.ts`.

Do not add a workspace, and do not import `@vasl/starter` from the live app. `@/` only resolves inside `src/`.
