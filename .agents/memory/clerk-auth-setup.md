---
name: Clerk Auth Setup
description: Details of how Clerk auth was wired across web, mobile, and API server in the Wayfare monorepo.
---

## Key decisions

- `@types/react` pinned to `"19.2.14"` in workspace `overrides` to prevent duplicate-type conflicts when Clerk deps resolve a different minor.
- Tailwind v4: `@layer theme, base, clerk, components, utilities;` declared before `@import 'tailwindcss'` in `index.css`; `tailwindcss({ optimize: false })` in `vite.config.ts` to prevent Clerk CSS reordering in prod builds.
- Landing page at `/` is always public; signed-in users see the Dashboard at `/`, signed-out see the landing — never redirect `/` to `/sign-in`.
- Routes must be exactly `path="/sign-in/*?"` and `path="/sign-up/*?"` in wouter (optional wildcard, not `/sign-in/*` or named params).
- `publishableKey` uses `publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)` from `@clerk/react/internal`.
- `proxyUrl={clerkProxyUrl}` is unconditional (empty string in dev is intentional).
- Phone/SMS sign-in NOT supported by Replit-managed Clerk.
- Mobile: `setAuthTokenGetter` lives in `(tabs)/_layout.tsx`, NOT in web code (web uses cookies).
- Expo dev script prefix: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY`.

**Why:** Clerk's proxy setup requires these exact patterns to work in both dev and prod without any NODE_ENV branching.
