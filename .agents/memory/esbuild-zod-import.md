---
name: esbuild zod import
description: api-server esbuild cannot resolve the zod/v4 subpath export — always use the main zod entry point.
---

The api-server bundles with esbuild. The `zod/v4` subpath export is not resolvable by esbuild even though it works under ts/node.

**Rule:** In any api-server route, import Zod as `import { z } from "zod"` — never `from "zod/v4"`.

**Why:** esbuild resolves package.json `exports` differently from Node/tsc. The `zod/v4` subpath is not in the `external` list and is not bundleable in this config, causing a hard build failure.

**How to apply:** If Zod validation is needed in a route and the import fails to build, either (a) use `from "zod"`, or (b) add `zod` to api-server's `dependencies` in package.json so esbuild can find it via node_modules resolution. Option (a) is simpler.
