# Backend Architecture — ReadAssist Pro

Hybrid stack: **local-first SQLite** + **Supabase** for cloud data. No Firebase for user data.

## Layers

| Layer | Technology | Purpose |
|-------|------------|---------|
| Device source of truth | SQLite (`readassist.db`) | Documents, metrics, annotations, gamification — offline always |
| Cloud sync | Supabase (Postgres + RLS + Storage) | Auth, sync, optional file backup |
| Push | Expo Notifications | Streaks, break reminders (FCM/APNs via EAS) |
| Crashes | Sentry (optional, env-gated) | Production error tracking |
| Analytics | PostHog or Supabase events (opt-in) | Product metrics; no raw gaze upload |
| Payments | Stripe via Supabase Edge Function | Premium subscription |

## Data flow

```
Screens → DataService → LocalDatabaseService (SQLite)
                      → SyncEngine → SupabaseRepository (when signed in + online)
```

## Local-only mode

Leave `EXPO_PUBLIC_SUPABASE_URL` unset. App generates a local user ID and runs fully offline.

## Self-hosting

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for Docker self-host instructions.

## Entity contract

See [ENTITY_REGISTRY.md](./ENTITY_REGISTRY.md) for all type and service names.
