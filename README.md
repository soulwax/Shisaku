# shisaku

My own custom Astro blogging engine — a database-backed devlog for experiments, notes, and shipped little ideas.

Live at **[shisaku.dev](https://shisaku.dev)**.

This is not a theme or a starter dropped onto a default. It's a hand-built publishing engine I wrote from the ground up: Astro SSR on the front, Neon Postgres on the back, GitHub OAuth for sign-in, and a custom admin authoring flow. Everything from the Markdown rendering pipeline to comments to the deploy story is my own.

## What's in it

- **Astro SSR** rendered on Vercel via `@astrojs/vercel`.
- **Postgres-backed content** — posts (published and draft) live in Neon, managed through Drizzle ORM and migrations, not in flat files.
- **Custom admin authoring** — a protected dashboard for writing and editing entries, locked to a single configurable GitHub account (`ADMIN_GITHUB_USERNAME`).
- **Automation API** — a token-authenticated JSON CRUD API (`/api/posts`) for scripted and agent-driven blogging: create, read, update, patch, delete posts, and adjust individual tags. See [Automation API](#automation-api).
- **GitHub OAuth** — readers sign in to comment; authoring is locked to the owner.
- **Comments** on devlog entries, tied to authenticated GitHub identities.
- **Own Markdown pipeline**, RSS feed, light/dark theming, and a terminal-flavored UI.

## Commands

| Command | Action |
| :-- | :-- |
| `pnpm install` | Install dependencies |
| `astro dev --background` | Start the local dev server in background mode |
| `astro dev status` | Check the background dev server |
| `astro dev logs` | View dev-server logs |
| `astro dev stop` | Stop the background dev server |
| `pnpm run check` | Type-check Astro and TypeScript |
| `pnpm run test` | Run the unit tests |
| `pnpm run build` | Build the Vercel serverless output |
| `pnpm run db:generate` | Generate a Drizzle migration |
| `pnpm run db:migrate` | Apply migrations with the direct PostgreSQL connection |
| `pnpm run seed:posts` | Idempotently seed the devlog posts |

## Automation API

A JSON HTTP API for automated blogging — publish from scripts, CI pipelines, cron jobs, or AI agents without touching the admin UI. All endpoints live under `/api/posts` and speak JSON in both directions.

### Authentication

Two ways in; either is sufficient:

1. **Bearer token** (the automation path): send `Authorization: Bearer <BLOG_API_TOKEN>`. The token is the value of the `BLOG_API_TOKEN` environment variable. If that variable is unset, token authentication is **disabled entirely** — the safe default, mirroring `ADMIN_GITHUB_USERNAME`.
2. **Admin session cookie** (the browser path): the signed-in admin's session works too, so the same endpoints can back interactive tooling.

Generate a strong token and set it alongside the other environment variables:

```sh
# generate
openssl rand -base64 32          # or: node -e "console.log(crypto.randomBytes(32).toString('base64url'))"

# local: add to .env.local
BLOG_API_TOKEN=<generated-value>

# production
vercel env add BLOG_API_TOKEN production preview development
```

Reads of **published** posts are public (no auth). Everything else — creating, updating, deleting, and any access to drafts — requires auth. Unauthenticated requests for a draft return `404` (not `401`), so draft existence is never leaked.

### Conventions

- **`:idOrSlug`** — every single-post endpoint accepts either the post's UUID (`e7a1…`) or its slug (`my-first-post`). UUIDs are detected by shape; anything else is treated as a slug.
- **Slugs are auto-uniquified** — if a requested or derived slug is taken, `-2`, `-3`, … is appended. On create, `slug` is optional (derived from the title). The response always tells you the slug you actually got.
- **Dates** — send `pubDate` as anything `new Date()` parses, ISO 8601 recommended (`2026-07-03T12:00:00Z`). Responses always return ISO 8601 UTC strings.
- **Tags** — arrays of strings; trimmed, deduplicated, max 64 tags of 64 chars each. Tag *removal* matches case-insensitively.
- **`status`** — `"draft"` or `"published"`. Only published posts appear on the site, in the RSS feed, and to unauthenticated API readers.
- **Markdown** — `bodyMarkdown` is CommonMark; it is rendered server-side through the same sanitized pipeline as the admin UI (raw HTML is stripped). Read time is recomputed automatically on every write.
- **Errors** — always JSON: `{ "error": "…" }`, with an optional `details` array of `{ path, message }` for validation failures.
- **Always send `Content-Type: application/json` on POST/PUT/PATCH/DELETE — even when there is no body** (e.g. `DELETE /api/posts/:idOrSlug`). Astro's built-in CSRF protection rejects mutating requests with a missing or form-like content type with a `403` before they reach the API.

| Status | Meaning |
| :-- | :-- |
| `200` | Success (`201` for creation) |
| `400` | Malformed JSON, failed validation, or invalid query parameter |
| `401` | Missing/invalid token and no admin session |
| `403` | Mutation sent without `Content-Type: application/json` (CSRF protection) |
| `404` | No such post — or a draft requested without auth |
| `500` | Unexpected server error (JSON, never an HTML error page) |

### Endpoints

| Method | Path | Auth | Purpose |
| :-- | :-- | :-- | :-- |
| `GET` | `/api/posts` | public¹ | List posts (filter by status, tag; paginate) |
| `POST` | `/api/posts` | required | Create a post |
| `GET` | `/api/posts/:idOrSlug` | public¹ | Fetch one post |
| `PUT` | `/api/posts/:idOrSlug` | required | Replace a post |
| `PATCH` | `/api/posts/:idOrSlug` | required | Partially update a post |
| `DELETE` | `/api/posts/:idOrSlug` | required | Delete a post |
| `GET` | `/api/posts/:idOrSlug/tags` | public¹ | List a post's tags |
| `POST` | `/api/posts/:idOrSlug/tags` | required | Add one or more tags |
| `PUT` | `/api/posts/:idOrSlug/tags` | required | Replace the whole tag list |
| `PUT` | `/api/posts/:idOrSlug/tags/:tag` | required | Add a single tag (idempotent) |
| `DELETE` | `/api/posts/:idOrSlug/tags/:tag` | required | Remove a single tag (idempotent) |

¹ public for published posts; auth required to see drafts.

The examples below assume:

```sh
BASE=https://shisaku.dev        # or http://localhost:4321 in dev
AUTH="Authorization: Bearer $BLOG_API_TOKEN"
JSON="Content-Type: application/json"
```

#### `GET /api/posts` — list posts

Query parameters (all optional):

| Param | Values | Default | Notes |
| :-- | :-- | :-- | :-- |
| `status` | `published`, `draft`, `all` | `published` | `draft`/`all` require auth |
| `tag` | any tag | — | exact match |
| `limit` | `1`–`100` | `20` | |
| `offset` | `0`+ | `0` | for pagination |

```sh
curl "$BASE/api/posts?tag=rust&limit=5"
curl -H "$AUTH" "$BASE/api/posts?status=draft"
```

```json
{ "posts": [ { "id": "…", "slug": "…", "title": "…", "…": "…" } ], "count": 5 }
```

#### `POST /api/posts` — create a post

| Field | Type | Required | Notes |
| :-- | :-- | :-- | :-- |
| `title` | string ≤ 180 | ✔ | |
| `description` | string ≤ 500 | ✔ | shown in lists / meta description |
| `bodyMarkdown` | string | ✔ | CommonMark |
| `slug` | string ≤ 180 | | derived from title when omitted; auto-uniquified |
| `heroImage` | string \| null | | URL/path of the hero image |
| `tags` | string[] | | |
| `status` | `draft` \| `published` | | default `draft` |
| `pubDate` | date string | | default: now |

```sh
curl -X POST "$BASE/api/posts" -H "$AUTH" -H "$JSON" -d '{
  "title": "Shipping the automation API",
  "description": "The devlog can now blog itself.",
  "bodyMarkdown": "# Hello\n\nWritten by a robot, reviewed by a human.",
  "tags": ["automation", "astro"],
  "status": "draft"
}'
```

Returns `201` with the full post — keep `id` and `slug` for follow-up calls:

```json
{ "post": { "id": "1c4e…", "slug": "shipping-the-automation-api", "status": "draft", "url": "/blog/shipping-the-automation-api/", "…": "…" } }
```

#### `GET /api/posts/:idOrSlug` — fetch one post

```sh
curl "$BASE/api/posts/shipping-the-automation-api"
curl -H "$AUTH" "$BASE/api/posts/1c4e…"        # drafts need auth
```

#### `PUT /api/posts/:idOrSlug` — replace a post

Full replace with two deliberate exceptions: `title`, `description`, `bodyMarkdown`, and `status` are **required**; omitting `heroImage` clears it and omitting `tags` empties them — but omitting `slug` or `pubDate` **keeps the current values**, because silently regenerating either would break URLs and feed ordering.

```sh
curl -X PUT "$BASE/api/posts/shipping-the-automation-api" -H "$AUTH" -H "$JSON" -d '{
  "title": "Shipping the automation API",
  "description": "The devlog now blogs itself.",
  "bodyMarkdown": "# Hello again\n\nFully rewritten body.",
  "tags": ["automation", "astro", "api"],
  "status": "published"
}'
```

#### `PATCH /api/posts/:idOrSlug` — partial update

Send only what should change; everything else is untouched. All create fields are accepted, plus incremental tag fields:

- `addTags: string[]` — append (duplicates ignored)
- `removeTags: string[]` — remove (case-insensitive)
- `tags: string[]` — replace the whole list (cannot be combined with the two above)
- `heroImage: null` — explicitly clear the hero image

```sh
# publish a draft
curl -X PATCH "$BASE/api/posts/shipping-the-automation-api" -H "$AUTH" -H "$JSON" \
  -d '{"status": "published"}'

# fix a typo in the title only
curl -X PATCH "$BASE/api/posts/1c4e…" -H "$AUTH" -H "$JSON" \
  -d '{"title": "Shipping the Automation API"}'

# retag incrementally in one call
curl -X PATCH "$BASE/api/posts/1c4e…" -H "$AUTH" -H "$JSON" \
  -d '{"addTags": ["devlog"], "removeTags": ["draft-ideas"]}'
```

#### `DELETE /api/posts/:idOrSlug` — delete a post

Deletes the post and (via cascade) its comments. There is no undo. Note the
content-type header — required even though there is no body (see [Conventions](#conventions)).

```sh
curl -X DELETE "$BASE/api/posts/1c4e…" -H "$AUTH" -H "$JSON"
```

```json
{ "deleted": true, "id": "1c4e…", "slug": "shipping-the-automation-api" }
```

#### Tag endpoints — small, surgical changes

All tag mutations return the resulting list, so clients never need a follow-up read:

```sh
# read tags
curl "$BASE/api/posts/shipping-the-automation-api/tags"
# → { "id": "1c4e…", "slug": "shipping-the-automation-api", "tags": ["automation", "astro"] }

# add one tag (idempotent — re-adding an existing tag is a no-op success)
curl -X PUT "$BASE/api/posts/shipping-the-automation-api/tags/rust" -H "$AUTH" -H "$JSON"

# add several at once (body: {"tag": "one"} or {"tags": ["several", "at-once"]})
curl -X POST "$BASE/api/posts/shipping-the-automation-api/tags" -H "$AUTH" -H "$JSON" \
  -d '{"tags": ["gamedev", "notes"]}'

# replace the whole list
curl -X PUT "$BASE/api/posts/shipping-the-automation-api/tags" -H "$AUTH" -H "$JSON" \
  -d '{"tags": ["automation"]}'

# remove one tag (case-insensitive, idempotent; URL-encode if needed)
curl -X DELETE "$BASE/api/posts/shipping-the-automation-api/tags/notes" -H "$AUTH" -H "$JSON"
```

### Recipe: an agent publishing end-to-end

```sh
# 1. Draft
POST_JSON=$(curl -s -X POST "$BASE/api/posts" -H "$AUTH" -H "$JSON" \
  -d '{"title":"Nightly build report","description":"What changed tonight.","bodyMarkdown":"…"}')
SLUG=$(echo "$POST_JSON" | jq -r .post.slug)

# 2. Iterate on the body as often as needed
curl -s -X PATCH "$BASE/api/posts/$SLUG" -H "$AUTH" -H "$JSON" \
  -d '{"bodyMarkdown":"… revised …"}'

# 3. Tag and publish
curl -s -X PUT   "$BASE/api/posts/$SLUG/tags/ci" -H "$AUTH" -H "$JSON"
curl -s -X PATCH "$BASE/api/posts/$SLUG" -H "$AUTH" -H "$JSON" \
  -d '{"status":"published"}'
```

## Project Structure

```text
public/
src/
  assets/
  actions/
  components/
  db/
  lib/
  layouts/
  pages/
    api/
      posts/          # automation API (CRUD + tag endpoints)
scripts/
  seed-content/
astro.config.mjs
drizzle.config.ts
package.json
```

Static assets live in `public/`. Published and draft posts live in Neon Postgres. Seed
entries are retained in `scripts/seed-content/` as migration inputs.

Local environment variables are loaded from `.env.local`, with `.env` as an optional fallback.
Vercel deployments use encrypted project environment variables. GitHub OAuth lets readers comment.

For a fresh environment, run `pnpm run db:migrate` followed by `pnpm run seed:posts`.

## Make it your own

Nothing about the owner is hardcoded — the engine is meant to be deployed by anyone for
their own blog. Two pieces of configuration decide whose blog it is:

### Admin account (`ADMIN_GITHUB_USERNAME`)

Admin authoring (the protected `/admin` dashboard) is granted to exactly one GitHub login,
read from the `ADMIN_GITHUB_USERNAME` environment variable. Set it to your own GitHub handle
— the part after `github.com/`, e.g. `octocat`. It is case-insensitive.

```ini
ADMIN_GITHUB_USERNAME=your-github-login
```

If it is left empty, **no one** has admin access (the safe default for a public deployment).
Everyone else who signs in with GitHub becomes a regular commenter.

The same pattern applies to the automation API: `BLOG_API_TOKEN` unset means the
token-authenticated API is disabled (the admin session still works).

### Your domain (the callback domain is variable)

The OAuth **callback path is fixed** at `/admin/oauth/github/callback`, but the **domain is
entirely yours** — the TLD, the name, and any subdomain(s) can be whatever you deploy to. The
app builds the callback from the incoming request origin, so it works on `localhost`, on Vercel
preview URLs, and on your production domain without code changes.

When you register your GitHub OAuth app, use your own domain:

```text
Homepage URL: https://your-domain.example
Authorization callback URL: https://your-domain.example/admin/oauth/github/callback
```

(The live instance this repo powers uses `https://shisaku.dev` — swap in your own.)

## Vercel

The repository is configured for Astro SSR with `@astrojs/vercel`. Required encrypted variables:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
REDIS_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
ADMIN_GITHUB_USERNAME
BLOG_API_TOKEN          # optional — enables the automation API
```

Apply database migrations before promoting a deployment. The GitHub OAuth callback must point at
your own production domain (see [Make it your own](#make-it-your-own)).

From this linked project directory, set or update secrets with:

```sh
vercel env add DATABASE_URL production preview development
vercel env add DATABASE_URL_UNPOOLED production preview development
vercel env add REDIS_URL production preview development
vercel env add GITHUB_CLIENT_ID production preview development
vercel env add GITHUB_CLIENT_SECRET production preview development
vercel env add ADMIN_GITHUB_USERNAME production preview development
vercel env add BLOG_API_TOKEN production preview development
```

Then pull local Vercel variables when needed:

```sh
vercel env pull .env.local --yes --environment=production
```

## Author

Built and maintained by [soulwax](https://github.com/soulwax). Source lives at
[github.com/soulwax/shisaku-astro](https://github.com/soulwax/shisaku-astro), running live at
[shisaku.dev](https://shisaku.dev).
