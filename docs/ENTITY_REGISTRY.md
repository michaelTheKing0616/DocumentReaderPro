# ENTITY_REGISTRY — ReadAssist Pro

Last updated: 2026-05-27 | Schema version: 1.1.0

Living contract for names and types. Update this file whenever entities change.

## Session & Auth

| Name | Type | Location | Description |
|------|------|----------|-------------|
| SessionUser | interface | src/services/storage/types.ts | `{ id: string; email?: string; isLocalOnly: boolean }` |
| UserRole | type | src/types/index.ts | `'reader' \| 'parent' \| 'teacher'` |
| IAuthRepository | interface | src/services/storage/types.ts | signIn, signUp, signOut, getSession, signInAnonymously |

## Local Storage (SQLite — source of truth on device)

| Name | Type | Location | Description |
|------|------|----------|-------------|
| LocalDatabaseService | class | src/services/storage/local/LocalDatabaseService.ts | expo-sqlite CRUD |
| sync_queue | table | LocalDatabaseService | Offline mutation queue |
| documents | table | LocalDatabaseService | Local document metadata + filePath |
| profiles | table | LocalDatabaseService | Cached user profile |
| reading_metrics | table | LocalDatabaseService | Page/session metrics |
| gamification_state | table | LocalDatabaseService | Points, badges, streaks, challenges (JSON) |
| lesson_progress | table | LocalDatabaseService | Per-lesson progress/completion |
| LessonProgressRecord | interface | LocalDatabaseService | `{ lessonId, progress, completed, score?, updatedAt }` |
| folders | table | LocalDatabaseService | User library folders (JSON blob) |
| bookmarks | table | LocalDatabaseService | Document page bookmarks |
| annotations | table | LocalDatabaseService | Highlights, notes, drawings |
| document_search | FTS5 virtual table | LocalDatabaseService | Full-text document index |

## Cloud (Supabase — optional sync)

| Name | Type | Location | Description |
|------|------|----------|-------------|
| SupabaseClient | singleton | src/services/storage/supabase/SupabaseClient.ts | @supabase/supabase-js client |
| SupabaseRepository | class | src/services/storage/supabase/SupabaseRepository.ts | Postgres + Storage sync |
| gamification_state | table | supabase (scaffold) | Cloud gamification sync |
| profiles | table | supabase/migrations/001_initial.sql | User profiles (RLS) |
| documents | table | supabase/migrations/001_initial.sql | Cloud document metadata |
| reading_metrics | table | supabase/migrations/001_initial.sql | Aggregated metrics |

## Facade & Services

| Name | Type | Location | Description |
|------|------|----------|-------------|
| DataService | class | src/services/storage/DataService.ts | Local-first API; folders, bookmarks, annotations, FTS search, mergeLocalDataToCloud |
| SyncEngine | class | src/services/storage/sync/SyncEngine.ts | Drains sync_queue |
| LessonProgressService | class | src/services/lessons/LessonProgressService.ts | Curriculum progress CRUD |
| GamificationService | class | src/services/gamification/GamificationService.ts | Redux + SQLite + Supabase sync |
| PdfToolsService | class | src/services/document/PdfToolsService.ts | merge/split/compress/form/e-sign |
| AnnotationExportService | class | src/services/document/AnnotationExportService.ts | PDF/CSV annotation export |
| DocumentLoaderService | class | src/services/document/DocumentLoaderService.ts | Format-routing document loader |
| DocumentIndexService | class | src/services/document/DocumentIndexService.ts | FTS5 full-text search facade |
| LibraryService | class | src/services/document/LibraryService.ts | Folders & bookmarks CRUD |
| TxtParser | class | src/services/document/parsers/TxtParser.ts | Plain text parser |
| DocxParser | class | src/services/document/parsers/DocxParser.ts | DOCX via mammoth |
| EpubParser | class | src/services/document/parsers/EpubParser.ts | EPUB zip/text extraction (jszip) |
| RtfParser | class | src/services/document/parsers/RtfParser.ts | RTF tag stripper |
| ImageParser | class | src/services/document/parsers/ImageParser.ts | OCR via tesseract.js |
| ParsedDocument | interface | src/services/document/types.ts | `{ text, pageCount, toc?, pages? }` |
| TocEntry | interface | src/services/document/types.ts | TOC item with title, page, level |
| Folder | interface | src/services/storage/types.ts | Library folder entity |
| Bookmark | interface | src/services/storage/types.ts | Page bookmark entity |
| StoredAnnotation | interface | src/services/storage/types.ts | Annotation + documentId |
| DocumentSearchResult | interface | src/services/storage/types.ts | FTS search hit |
| ReaderCanvas | component | src/components/document/ReaderCanvas.tsx | Unified multi-format viewer |
| NavigationPanel | component | src/components/document/NavigationPanel.tsx | TOC & page jump UI |
| Annotator | component | src/components/document/Annotator.tsx | Highlight/underline/note annotations |
| ReadingModeController | component | src/components/document/ReadingModeController.tsx | Focus & guided reading modes |
| ThemeEngine | module | src/services/document/ThemeEngine.ts | OpenDyslexic + reader typography |
| InterventionEngine | class | src/services/intervention/InterventionEngine.ts | Evidence-based reading interventions |
| AuthScreen | screen | src/screens/AuthScreen.tsx | Supabase sign-in/sign-up UI |
| SyncProvider | component | src/components/SyncProvider.tsx | Offline sync lifecycle mount |
| GazeSource | interface | src/services/eye/GazeSource.ts | Gaze stream contract |
| WebGazerSource | class | src/services/eye/WebGazerSource.ts | Web WebGazer integration |
| AutoScrollController | class | src/services/eye/AutoScrollController.ts | Gaze-paced scroll |
| HardwareGazeAdapter | class | src/services/hardware/HardwareGazeAdapter.ts | Unified hardware gaze routing |
| Gaze360DataLoader | class | src/services/eye/Gaze360DataLoader.ts | Dev-only Gaze360 dataset loader |
| generateId / generateIdSync | functions | src/utils/id.ts | expo-crypto UUIDs |
| isMockDataEnabled | function | src/utils/mockGate.ts | Production mock gating |
| CloudDriveService | class | src/services/cloud/CloudDriveService.ts | Google/Dropbox/OneDrive OAuth scaffold |
| RealtimeService | class | src/services/collaboration/RealtimeService.ts | Supabase Realtime broadcast |
| StripeService | class | src/services/billing/StripeService.ts | Premium feature gates |
| ExportIntegrationsService | class | src/services/integrations/ExportIntegrationsService.ts | Evernote/Goodreads scaffold |
| BrightnessService | class | src/services/brightness/BrightnessService.ts | Fatigue-aware brightness |
| ARService | class | src/services/ar/ARService.ts | Dyslexia blue/yellow filters |

## UI Screens & Components

| Name | Type | Location | Description |
|------|------|----------|-------------|
| ParentDashboardScreen | screen | src/screens/ParentDashboardScreen.tsx | Role/premium-gated parent view |
| HPatternGame | component | src/components/lessons/HPatternGame.tsx | H-pattern tracking drill |
| CURRICULUM_MODULES | const | src/services/lessons/curriculum.ts | 30h / 6-module curriculum |

## i18n

| Name | Type | Location | Description |
|------|------|----------|-------------|
| useTranslation | hook | src/i18n/index.ts | en/es translations |

## Desktop

| Name | Type | Location | Description |
|------|------|----------|-------------|
| electron/main.js | entry | electron/main.js | Electron main process |
| electron/preload.js | bridge | electron/preload.js | contextBridge API |

## Domain Types

| Name | Type | Location |
|------|------|----------|
| UserProfile | interface | src/types/index.ts |
| Document | interface | src/types/index.ts |
| ReadingMetrics | interface | src/types/index.ts |
| GamificationState | interface | src/types/index.ts |
| EyeMetrics.blinkCount | field | src/types/index.ts |

## Environment

| Variable | Purpose |
|----------|---------|
| EXPO_PUBLIC_SUPABASE_URL | Supabase project URL |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Public anon key |
| EXPO_PUBLIC_SYNC_ENABLED | `"true"` to push/pull when online |
| EXPO_PUBLIC_SENTRY_DSN | Sentry error reporting |
| EXPO_PUBLIC_POSTHOG_KEY | PostHog analytics |
| EXPO_PUBLIC_POSTHOG_HOST | PostHog host URL |
| EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe publishable key |
| EXPO_PUBLIC_STRIPE_PRICE_ID | Premium price ID |
| EXPO_PUBLIC_MOCK_PREMIUM | `"true"` bypasses premium gates in dev |
| EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID | Google Drive OAuth |
| EXPO_PUBLIC_DROPBOX_CLIENT_ID | Dropbox OAuth |
| EXPO_PUBLIC_ONEDRIVE_CLIENT_ID | OneDrive OAuth |
| EXPO_PUBLIC_EVERNOTE_CONSUMER_KEY | Evernote export |
| EXPO_PUBLIC_GOODREADS_API_KEY | Goodreads export |

## Deprecated

| Name | Replaced by |
|------|-------------|
| FirebaseService | DataService |
