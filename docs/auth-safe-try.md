# Auth Flow — Never-Throw Safe Try

## Current State

The auth flow spans four files. The outer API boundary already never throws (returns discriminated unions), but the low-level helpers use `throw` internally, requiring nested try/catch blocks in callers.

### `convex/acadia/auth.ts` — `authenticateWithAxios`

- **Signature**: `(username, password) => Promise<string>` (returns cookie string)
- **Throws** at line 81 when `allCookies.length < 6`:  
  `throw new Error("Failed to authenticate with Acadia.")`
- Network/axios errors also propagate as uncaught throws.

### `convex/lib/encryption.ts` — `encryptCredentials` / `decryptCredentials`

- Both wrap their body in try/catch and **rethrow** with a message prefix.
- `encryptCredentials(username, password, token) => string` — throws on cipher failure.
- `decryptCredentials(encryptedString, token) => { username, password }` — throws on bad format, wrong key, or tampered data.

### `convex/auth.ts` — `authenticateUser` (action)

- Already returns `AuthResult` (success | failure discriminated union) — never throws at the API boundary.
- Uses **nested try/catch**: inner catch for `authenticateWithAxios` (→ 401), outer catch for everything else (→ 500).
- `encryptCredentials` failure is only caught by the outer catch, so it surfaces as a generic 500 with no specific messaging.

### `convex/acadia/impersonator.ts` — `getAcadiaImpersonator`

- Calls `decryptCredentials` (line 166) — uncaught throw propagates up.
- Calls `authenticateWithAxios` (line 171) — uncaught throw propagates up.
- This function itself throws on missing user / bad token / expired session, so callers already handle throws. But switching helpers to Result types would give more structured error info.

## Proposed Changes

### 1. `convex/acadia/auth.ts`

Convert `authenticateWithAxios` return type:

```
Before: Promise<string>                           (throws on failure)
After:  Promise<{ ok: true; cookies: string } | { ok: false; error: string }>
```

- Wrap entire body in try/catch → return `{ ok: false, error }` on any failure.
- Replace the `throw new Error(...)` at line 81 with `return { ok: false, error: "..." }`.
- Export the `AuthResult` type for callers.

### 2. `convex/lib/encryption.ts`

Convert both functions:

```
encryptCredentials:  string → Result<string>
decryptCredentials:  { username, password } → Result<{ username, password }>

where Result<T> = { ok: true; value: T } | { ok: false; error: string }
```

- Replace `throw` with `return { ok: false, error }`.
- Export the `Result` type.

### 3. `convex/auth.ts`

- Remove nested try/catch for `authenticateWithAxios` → branch on `authResult.ok`.
- Remove try/catch for `encryptCredentials` → branch on `encryptResult.ok`.
- Keep a single try/catch only for `ctx.runMutation` / `ctx.scheduler` (Convex runtime errors).

### 4. `convex/acadia/impersonator.ts` — `getAcadiaImpersonator`

- `decryptCredentials` call → check `.ok`, throw on failure (this function's contract remains throw-based for now).
- `authenticateWithAxios` call → check `.ok`, throw on failure.

## Files to Modify

| File | Change |
|------|--------|
| `convex/acadia/auth.ts` | Return `Result` from `authenticateWithAxios` |
| `convex/lib/encryption.ts` | Return `Result<T>` from both functions |
| `convex/auth.ts` | Result-based branching, remove nested try/catch |
| `convex/acadia/impersonator.ts` | Unwrap `Result` from decrypt/auth calls |
