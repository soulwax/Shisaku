# TODO — Shisaku Devlog Implementation

Source of truth: `../Shisaku/`

Foundation app: `./bluesix-dev-log/`

## Principle

Use `Shisaku/` to decide what the devlog should look, feel, and behave like. Use `bluesix-dev-log/` as the production Astro foundation that ships those ideas.

Do not invent a separate visual system in the Astro app when an equivalent exists in `Shisaku/`. Port the intent, class structure, spacing, type, and interaction patterns from the prototypes first, then adapt only where Astro or production constraints require it.

## Phase 1 — Port The Design

- [x] Audit `../Shisaku/bluesix.css` and list tokens/components that must exist in `src/styles/global.css`.
- [x] Replace remaining Bear Blog starter layout assumptions with Shisaku's terminal-flavoured layout system.
- [x] Make `/` the feed view, using the Shisaku feed/card pattern as the reference.
- [x] Update `src/layouts/BlogPost.astro` to match the Shisaku post reading view.
- [x] Update `Header.astro` and `Footer.astro` to match Shisaku chrome, including theme toggle behavior.
- [x] Wire fonts to match Shisaku: Spline Sans Mono for chrome/headings/meta/code and IBM Plex Sans for prose.
- [x] Verify light/dark mode against the Shisaku prototypes.
- [x] Keep existing content collections working until the CMS phase replaces them.
- [x] Build successfully with `pnpm run build`.

Status note: dark, light, and mobile layouts were verified against the Shisaku prototype with
`agent-browser`; `pnpm run check`, `pnpm run test`, and `pnpm run build` pass.

## Phase 2 — Auth + CMS Foundation

- [x] Convert Astro to SSR with the Node adapter.
- [x] Load env from `../Shisaku/.env` explicitly.
- [x] Add Neon Postgres + Drizzle schema and migrations.
- [x] Add Redis-backed session storage.
- [x] Implement GitHub OAuth against `github.com`.
- [x] Restrict admin access to GitHub username `soulwax`.
- [x] Validate the GitHub email suffix before creating an admin session.
- [x] Protect `/admin/**` with middleware.
- [x] Create admin routes for dashboard and post editing.
- [x] Use `bluesix-dev-log`'s current routes/components as the migration foundation, not a separate app.

## Phase 3 — CMS Content

- [x] Model posts in Postgres.
- [x] Migrate existing markdown/MDX content into seed data.
- [x] Render published posts from the database.
- [x] Render `/rss.xml` from published database posts.
- [x] Add a markdown-native editor for admin post creation/editing.
- [x] Sanitize rendered markdown before public display.

## Verification

- [x] Applied the initial Drizzle migration to the configured Neon database.
- [x] Seeded all five original posts with idempotent slug upserts.
- [x] Verified database post create, update, publish, read, and delete with cleanup.
- [x] Verified Redis session create, TTL, lookup, and delete.
- [x] Verified public feed, post, RSS, admin redirect, and GitHub OAuth redirect over HTTP.
- [x] Verified the production standalone Node build.

## Ongoing Rules

- [x] Check `../Shisaku/` before changing visual language.
- [x] Keep production code in `bluesix-dev-log/`.
- [x] Preserve `blog.shisaku.dev` as the deployment target.
- [x] Prefer small, verifiable steps over a full rewrite.
- [x] Run the Astro dev server with `astro dev --background`.
