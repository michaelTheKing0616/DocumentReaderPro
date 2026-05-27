# Supabase Setup — ReadAssist Pro

ReadAssist Pro uses **local-first SQLite** on device and **optional Supabase** for cloud sync.

## Why Supabase (not Firebase)

- **Open source** (Apache 2.0) — full stack on GitHub
- **Self-hostable** via Docker — no vendor lock-in
- **PostgreSQL** — SQL, migrations, Row Level Security
- **Free hosted tier** for development (500 MB DB, 50K MAU)

Firebase is proprietary and not self-hostable.

## Option A: Hosted free project (recommended for dev)

1. Create a project at [https://supabase.com](https://supabase.com)
2. Copy **Project URL** and **anon public** key from Settings → API
3. Copy `.env.example` to `.env` and set:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   EXPO_PUBLIC_SYNC_ENABLED=true
   ```
4. Run migrations: install [Supabase CLI](https://supabase.com/docs/guides/cli), then:
   ```bash
   supabase link --project-ref your-ref
   supabase db push
   ```
5. Create a Storage bucket named `documents` (public or RLS-protected per your policy)

## Option B: Self-hosted (free, you pay infra only)

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
docker compose up -d
```

Point `EXPO_PUBLIC_SUPABASE_URL` at your instance.

## Local-only mode (no Supabase)

Leave env vars unset or use placeholder values. The app runs fully offline with SQLite; no cloud sync.

## Architecture

```
Screens → DataService → LocalDatabaseService (SQLite, always)
                      → SyncEngine → SupabaseRepository (when online + signed in)
```

See [ENTITY_REGISTRY.md](./ENTITY_REGISTRY.md) for entity names and types.
