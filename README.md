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
| `pnpm run build` | Build the standalone Node server to `./dist/` |
| `pnpm run start` | Run the built standalone Node server |
| `pnpm run db:generate` | Generate a Drizzle migration |
| `pnpm run db:migrate` | Apply migrations with the direct PostgreSQL connection |
| `pnpm run seed:posts` | Idempotently seed the original starter posts |

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

Static assets live in `public/`. Published and draft posts live in Neon Postgres. The original
starter entries are retained in `scripts/seed-content/` as migration inputs.

Local environment variables are loaded explicitly from `../Shisaku/.env`. GitHub OAuth is
restricted to the `soulwax` account and a verified `users.noreply.github.com` email address.

The GitHub OAuth app callback URL is:

```text
https://blog.shisaku.dev/admin/oauth/github/callback
```

For a fresh environment, run `pnpm run db:migrate` followed by `pnpm run seed:posts`.

## Credit

This theme began from Astro's blog starter and Bear Blog's default CSS.
