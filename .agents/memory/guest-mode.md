---
name: Guest mode architecture
description: How guest (no-login) mode works end-to-end across frontend and API server.
---

## Rule
Guest users get a UUID stored in localStorage as `wayfare_guest_id` (prefixed `guest-`). That ID is sent on every API call as `Authorization: Bearer guest-<uuid>`. The API treats it as the userId, so all data is real server-side data scoped to the guest ID.

## Shared backend helper
All 7 route files import `requireUserId` from `artifacts/api-server/src/lib/requireUserId.ts`.
Never redeclare it locally — update the shared file if the auth logic needs to change.

The helper checks:
1. Clerk session (via `getAuth(req)`) — takes priority
2. `Authorization: Bearer guest-<uuid>` header — accepted if Clerk returns no userId

## Frontend wiring (App.tsx)
- `GuestModeInitializer` component (inside ClerkProvider): calls `setAuthTokenGetter(() => guestId)` when signed-out with a guest ID; clears it when signed in.
- `handleContinueAsGuest` in `Landing`: generates UUID, saves to localStorage, sets auth getter, navigates to `/`.
- `ProtectedRoute` and `HomeRoute`: check `useIsGuest()` (reads localStorage) alongside `useUser().isSignedIn`.
- `GuestBanner`: shown in `AppShell` when guest mode is active — prompts to create an account or exit.

## Why
Allows users to try the app without an account. Data is real (server-persisted), scoped to the guest ID. If they sign up later, they get a clean account (guest data stays in DB but unreachable — migration is a future feature).

## How to apply
- When adding a new protected route, use `ProtectedRoute` — it already handles guest pass-through.
- When adding a new API route, import `requireUserId` from `../lib/requireUserId` (never write a local copy).
