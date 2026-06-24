# Shisaku Devlog — Restyle + CMS Design

**Date:** 2026-06-24
**Project:** `bluesix-dev-log` (Astro app; package name `shisaku-dev-log`)
**Status:** Approved design, pending spec review

## Goal

Two outcomes, delivered as two phases:

1. **Restyle** — port Shisaku's terminal/mono visual language into the Astro site, with Shisaku as the source of truth.
2. **CMS** — turn the static, content-collection blog into an SSR app where multiple admins author posts through a WYSIWYG editor, with posts and credentials stored in Neon Postgres via Drizzle.

Phase 1 ships independently of Phase 2.

## Decisions (locked)

| Area | Decision |
| --- | --- |
| Post storage | Database rows (full CMS), not markdown files. SSR rendering. |
| Database | Neon Postgres via Drizzle ORM. Conn strings in `./Shisaku/.env` (`DATABASE_URL` pooled for runtime, `DATABASE_URL_UNPOOLED` for migrations). |
| Sessions | Redis (`REDIS_URL` from the same `.env`), TTL-native. |
| Host / adapter | `@astrojs/node` standalone (host-agnostic; Neon's serverless driver works over HTTP). |
| Auth | GitHub OAuth only (`github.com`). Only the GitHub username `soulwax` is authorized as admin. The returned GitHub account email must use a GitHub email suffix (for example GitHub's noreply suffix) before an admin session is created. Hand-rolled sessions remain random-token/httpOnly-cookie based. No public signup. |
| Editor | Milkdown Crepe (markdown-native WYSIWYG), client-side island, outputs markdown. |
| Mutations | Astro Actions + middleware guarding `/admin/**`. |
| Markdown render | `markdown-it` + `@shikijs/markdown-it`, then `sanitize-html`. |
| Existing posts | Migrate `src/content/blog/*` into the DB as seed posts (plain markdown; MDX component features dropped). |
| Index page | `/` becomes the feed (per the Shisaku index mockup), not a separate hero landing. |
| Images | Hero + inline images are URLs only. Upload/object-storage deferred. |

## Phase 1 — Restyle (no backend)

Self-contained, still static, still building from the existing markdown. Visually matches Shisaku on completion.

### Changes

- **Global stylesheet:** Adopt `Shisaku/bluesix.css` as `src/styles/global.css` (source of truth), replacing the Bear-Blog-derived styles. Delete conflicting component-scoped styles.
- **Fonts:** Replace Atkinson (`fontProviders.local()`) with **Spline Sans Mono** (`--mono`) and **IBM Plex Sans** (`--sans`) via Astro's fonts API (Google provider), wired to the CSS variables `bluesix.css` already references. Remove the Atkinson woff assets.
- **Theme:** Add a manual dark/light toggle that writes `data-theme` and persists to `localStorage`, following system preference on first visit (Shisaku behavior). Replaces the `prefers-color-scheme`-only approach. Inline the no-flash theme script in `<head>`.
- **Markup → Shisaku class structure:**
  - `Header.astro` → `.site-head` / `.brand` (mark + `name` with muted `.path`) / `nav.site-nav` + theme `.toggle`.
  - `index.astro` → `.feed` of `.entry` cards (meta row, `.entry-title` with caret, dek, tags, read-arrow), with the mono `.feed-intro`. Becomes the feed.
  - `BlogPost.astro` → `.post` / `.back` / `.post-head` (meta, title, dek, tags) / `.post-body` with `##`/`###` heading prefixes, custom list markers, code styling, blockquote/`.aside-note`, `.stat-grid`, `.post-foot` reader-notes.
  - `Footer.astro` → `.site-foot`.
  - Shared `.badge` component for build-number badges.
- **Layout width:** match Shisaku's `.wrap` (max-width 720px) rather than the current mixed 960/1120px.

### Out of scope for Phase 1

No data changes; posts still load from content collections until Phase 2.

## Phase 2 — CMS (SSR + Neon + Drizzle + Redis)

### Config / dependencies

- `astro.config.mjs`: `output: 'server'`, `adapter: node({ mode: 'standalone' })`.
- Add: `@astrojs/node`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `markdown-it`, `@shikijs/markdown-it`, `sanitize-html`, `@milkdown/crepe`, a Redis client (`ioredis`), `dotenv`.
- Remove: `@astrojs/mdx`, `src/content.config.ts`, `src/content/blog/`.
- Env loading: load `../Shisaku/.env` explicitly (via `dotenv` with an explicit path) in `astro.config.mjs`, `drizzle.config.ts`, and the server entry, since the file lives outside the Astro project root.

### Data model (Drizzle / Neon Postgres)

- **`users`** — `id` (uuid, pk), `github_id` (unique), `username` (unique), `email`, `role` (`admin`), `created_at`, `last_login_at`.
- **`posts`** — `id` (uuid, pk), `slug` (unique), `title`, `description`, `body_markdown`, `hero_image` (text url, nullable), `status` (`draft` | `published`), `pub_date`, `updated_date`, `author_id` → `users`, `created_at`, `updated_at`.

Sessions live in **Redis** (key = token, value = user id, TTL = session lifetime), not Postgres.

### Rendering

Public post pages SSR-query Postgres and render `body_markdown` → HTML via `markdown-it` + `@shikijs/markdown-it` (code styling matching Shisaku), then `sanitize-html`. The feed and RSS query published posts ordered by `pub_date` desc.

### Routes

**Public**
- `/` — feed (published only), Shisaku index look.
- `/blog/[slug]` — single post, SSR from DB.
- `/rss.xml` — RSS from DB.
- `/about` — static.

**Admin** (guarded by `src/middleware.ts`)
- `/admin/login` — GitHub OAuth entrypoint.
- `/admin/oauth/github/callback` — GitHub OAuth callback.
- `/admin` — dashboard: post list with draft/publish state.
- `/admin/posts/new`, `/admin/posts/[id]/edit` — Milkdown editor + metadata (title, slug, description, hero URL, status, dates).

Mutations (create/update/publish post, logout) are Astro Actions.

### Auth flow

1. `/admin/login` starts GitHub OAuth against `github.com`.
2. OAuth callback exchanges the code, loads the GitHub user profile, and only allows username `soulwax`.
3. The callback also validates that the returned email uses the configured GitHub email suffix.
4. On success, upsert the admin user by GitHub id, generate a random token, store `token → userId` in Redis with TTL, and set an httpOnly, SameSite=Lax, Secure cookie.
5. `middleware.ts` validates the cookie on every `/admin/**` request, loads the user, and exposes it via `Astro.locals`. Unauthenticated → redirect to `/admin/login`.
6. Logout deletes the Redis key and clears the cookie.

### Seed / migration

A one-time script reads `src/content/blog/*.{md,mdx}`, parses frontmatter, and inserts rows into `posts` (treated as plain markdown), so the CMS launches with existing content. Run after the schema migration.

### Migrations

`drizzle-kit` generates and applies SQL migrations against `DATABASE_URL_UNPOOLED`. Scripts: `db:generate`, `db:migrate`, `seed:posts`.

## Out of scope (deferred enhancements)

Image/file uploads & object storage, comments, tags as first-class entities, scheduled publishing, full-text search, password reset/email flows.

## Testing

- Phase 1: visual verification against the Shisaku mockups (feed, post, header/footer, both themes); build succeeds.
- Phase 2: unit tests for auth (GitHub profile allowlist, email suffix validation, session create/validate/expire, middleware redirect), post CRUD actions, and markdown render+sanitize; an integration pass covering GitHub login → create post → publish → public render.

## Risks / notes

- `.env` lives in `Shisaku/`, outside the Astro root — env loading must point there explicitly; secrets stay out of the repo.
- Dropping content collections removes build-time frontmatter type-checking; the Drizzle schema + Action input validation replace it.
- Edge/serverless hosts are not a target (Redis + Node adapter assume a persistent Node runtime). Revisit the session store if that changes.
