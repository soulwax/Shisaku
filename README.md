# shisaku

My own custom Astro blogging engine — a database-backed devlog for experiments, notes, and shipped little ideas.

Live at **[shisaku.dev](https://shisaku.dev)**.

This is not a theme or a starter dropped onto a default. It's a hand-built publishing engine I wrote from the ground up: Astro SSR on the front, Neon Postgres on the back, GitHub OAuth for sign-in, and a custom admin authoring flow. Everything from the Markdown rendering pipeline to comments to the deploy story is my own.

## What's in it

- **Astro SSR** rendered on Vercel via `@astrojs/vercel`.
- **Postgres-backed content** — posts (published and draft) live in Neon, managed through Drizzle ORM and migrations, not in flat files.
- **Custom admin authoring** — a protected dashboard for writing and editing entries, restricted to my GitHub account (`github.com/soulwax`).
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
Admin authoring is restricted to the GitHub account `github.com/soulwax`.

The GitHub OAuth app settings should use:

```text
Homepage URL: https://shisaku.dev
Authorization callback URL: https://shisaku.dev/admin/oauth/github/callback
```

For a fresh environment, run `pnpm run db:migrate` followed by `pnpm run seed:posts`.

## Vercel

The repository is configured for Astro SSR with `@astrojs/vercel`. Required encrypted variables:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
REDIS_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
```

Apply database migrations before promoting a deployment. The GitHub OAuth callback must remain
the production URL shown above.

From this linked project directory, set or update secrets with:

```sh
vercel env add DATABASE_URL production preview development
vercel env add DATABASE_URL_UNPOOLED production preview development
vercel env add REDIS_URL production preview development
vercel env add GITHUB_CLIENT_ID production preview development
vercel env add GITHUB_CLIENT_SECRET production preview development
```

Then pull local Vercel variables when needed:

```sh
vercel env pull .env.local --yes --environment=production
```

## Author

Built and maintained by [soulwax](https://github.com/soulwax). Source lives at
[github.com/soulwax/shisaku-astro](https://github.com/soulwax/shisaku-astro), running live at
[shisaku.dev](https://shisaku.dev).
</content>
</invoke>
