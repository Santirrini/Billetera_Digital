# Billetera Digital - Agent Guide

## Run Commands

From repo root (`C:\Users\Jose Diaz\Documents\Billetera_digital`):

```powershell
# Frontend only
pnpm dev:frontend

# Backend only
pnpm dev:backend

# Both (runs sequentially in same terminal; prefer separate terminals)
pnpm dev
```

Prefer two separate terminals for live reload:

```powershell
# Terminal 1 — Backend (FastAPI)
cd backend; venv\Scripts\activate; uvicorn app.main:app --reload

# Terminal 2 — Frontend (Expo)
cd frontend; pnpm start
```

No lint, typecheck, or test scripts exist. The only test is `frontend/components/__tests__/StyledText-test.js` (snapshot, no runner configured).

## Project Structure

Two independent apps (no root workspace/manifest):
- **`backend/`** — FastAPI + Supabase + OpenAI. Entry: `app/main.py`. Polls Gmail every 5 min via background task (`asyncio.create_task`). Routes under `/api/`.
- **`frontend/`** — Expo SDK 54 with Expo Router (file-based). Path alias `@/` → frontend root. NativeWind (TailwindCSS) in deps but mixing raw `StyleSheet.create`. Dark theme via `COLORS` constant.

## Key Quirks

- **OpenAI is optional**: LLM features (`llm_processor.py`) return `None` silently if key is placeholder `your_openai_api_key_here`. Static regex fallback still works.
- **`.env` has real secrets committed** (Supabase URL/anon key, email credentials). Not a template.
- **Email pipeline**: regex parse → LLM fallback (if confidence <0.6) → register transaction → LLM enrichment/categorization.
- **Backend prefix**: all routers use `/api/` prefix. Frontend `services/api.ts` calls `http://localhost:8000` by default, override with `EXPO_PUBLIC_API_URL`.
- **Background email polling**: runs on FastAPI `lifespan`, polls every 300s. CORS allows all origins.
- **Frontend tabs**: `app/(tabs)/` group — `index.tsx` (Dashboard), `transactions.tsx`, `statistics.tsx`, `settings.tsx`.
- **NativeWind**: in deps but no `tailwind.config.js` or `babel.config.js` found — may not be fully wired. Prefer `StyleSheet.create`.
