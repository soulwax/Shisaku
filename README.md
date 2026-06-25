# shisaku devlog

An Astro-powered, database-backed devlog for experiments, notes, and shipped little ideas.

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
| `pnpm run seed:posts` | Idempotently seed the EchoWarrior devlog posts |

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

Static assets live in `public/`. Published and draft posts live in Neon Postgres. The
EchoWarrior devlog entries are retained in `scripts/seed-content/` as migration inputs.

Local environment variables are loaded from `.env.local`, with `.env` as an optional fallback.
Vercel deployments use encrypted project environment variables. GitHub OAuth is restricted to
the `soulwax` account and a verified `users.noreply.github.com` email address.

The GitHub OAuth app callback URL is:

```text
https://shisaku.dev/admin/oauth/github/callback
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
GITHUB_ALLOWED_EMAIL_SUFFIX
```

Set `GITHUB_ALLOWED_EMAIL_SUFFIX` to `users.noreply.github.com`. Apply database migrations before
promoting a deployment. The GitHub OAuth callback must remain the production URL shown above.

From this linked project directory, set or update secrets with:

```sh
vercel env add DATABASE_URL production preview development
vercel env add DATABASE_URL_UNPOOLED production preview development
vercel env add REDIS_URL production preview development
vercel env add GITHUB_CLIENT_ID production preview development
vercel env add GITHUB_CLIENT_SECRET production preview development
vercel env add GITHUB_ALLOWED_EMAIL_SUFFIX production preview development
```

Then pull local Vercel variables when needed:

```sh
vercel env pull .env.local --yes --environment=production
```

## Credit

This theme began from Astro's blog starter and Bear Blog's default CSS.
