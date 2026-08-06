# Acadia One Project Direction

## Purpose

Acadia One is being rebuilt around a cleaner domain model and a more deliberate application architecture. The repository on `main` is the integration target. The separate refined worktree at `~/dev/worktrees/acadia-one/modest-tern/acadia-one` is the architectural reference for the new schema, backend organization, and technology stack.

The refined worktree is a reference implementation, not a file-for-file patch set and not necessarily a complete product. Study it before making architectural decisions, then adapt its intent cleanly to `main`.

## Sources of Truth

- `main` is the branch where the rebuilt application is assembled and ultimately shipped.
- The refined worktree is the preferred reference for the target data model, backend boundaries, runtime, dependencies, and project structure.
- Existing functionality on `main`, especially user-facing behavior, remains useful product context when the refined worktree does not yet implement the equivalent behavior.
- The current user request always takes precedence over this document.

When the two codebases disagree, do not automatically preserve the older implementation on `main`. Determine whether the difference reflects the intended new architecture or product behavior that still needs to be carried forward.

## Migration Order

Build the new application in this order:

1. Backend schema and persistence model
2. Backend integrations, workflows, and application APIs
3. Frontend data access and user interface

Respect these dependency boundaries. The frontend should be built against stable backend contracts rather than recreating business logic or compensating for unfinished data modeling in client code. Do not expand the legacy backend merely to unblock frontend work unless the user explicitly asks for that approach.

## Target Architecture

The refined worktree currently expresses the intended direction: Bun, TanStack Start, Drizzle ORM with SQLite, Zod validation at external boundaries, and server code organized into extractors, schemas, and workflows. Verify the worktree before relying on exact versions or commands because the reference can evolve.

Prefer the following principles throughout the rebuild:

- Model the domain explicitly before exposing APIs or building UI around it.
- Derive application types from schemas where practical instead of maintaining parallel shapes.
- Validate third-party responses at the boundary and normalize inconsistent external values there.
- Keep extraction, normalization, persistence, and presentation concerns separate.
- Design backend APIs around application use cases rather than leaking database or upstream API shapes.
- Use migrations and indexes that match actual access patterns.
- Treat the rebuild as greenfield architecture unless compatibility is explicitly required. Avoid carrying obsolete abstractions forward only because they exist on `main`.

## Working in the Repository

Before implementing a change:

1. Confirm which worktree and branch the task targets.
2. Inspect the relevant implementation and uncommitted changes in both `main` and the refined worktree.
3. Identify which migration layer the change belongs to: schema, backend/API, or frontend.
4. Follow the target architecture for new code while preserving relevant product behavior.

Keep changes cohesive and scoped. Do not overwrite unrelated or uncommitted work. Add verification appropriate to the layer being changed, and call out pre-existing failures separately from failures introduced by the change.
