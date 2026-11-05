# Vasl Console

Management console for Vasl Media Server. It signs in against the media server REST API (`/rest/v2`) and is served as a static export into the media server web root when `BUILD_STATIC=true`.

## Run

```bash
bun install
bun run dev
```

The dev server proxies `/rest` to `http://127.0.0.1:5080`. A static build is `bun run build`.

## Layout

| Path | What it is |
| --- | --- |
| `src/app` | Routes: login, dashboard, applications, cluster, logs, settings, support |
| `src/features/console` | The console screens |
| `src/components/ui` | The few shadcn primitives those screens use |
| `src/styles/themes/vasl.css` | The Vasl theme |
| `packages/starter` | Archived dashboard starter. Not compiled and not imported. See [packages/starter/README.md](./packages/starter/README.md) |

Copy a starter file back into `src/` when you want it. Do not import the starter package from the console.

Deployment notes are in [docs/deployment.md](./docs/deployment.md).
