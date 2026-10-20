# Shorts Studio Frontend

A modern web frontend for **Shorts Studio**, an automated pipeline tool that produces short-form video content step-by-step. Built from scratch with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **TanStack Query**.

---

## Prerequisites

* **Node.js**: `20.x` or higher (verified on `v22.23.1`)
* **npm**: `10.x` or higher
* **Shorts Studio Backend**: FastAPI service running locally at `http://localhost:8000`

---

## Getting Started

### 1. Installation

Install all required dependencies:

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

The default contents of `.env.local`:

```env
# FastAPI Backend URL for Next.js rewrites
API_URL=http://localhost:8000
```

> **Note on .gitignore**: `.env.local` is ignored to prevent committing local secrets, but `.env.local.example` is tracked as a template.

### 3. Running Locally (Port 3000)

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works with the Backend (No CORS Needed)

The frontend communicates with the backend via a same-origin Next.js rewrite configured in `next.config.ts`:

* When the browser makes a request to `/api/*`, Next.js automatically proxies it to `${API_URL}/*` (e.g. `http://localhost:8000/*`).
* The rewrite preserves HTTP methods, query parameters, `application/x-www-form-urlencoded` login payloads, and binary file download streams without requiring CORS configuration on the backend.

---

## Architecture & Key Concepts

### 1. Authentication & Token Handling (`src/lib/auth.ts`)
* For **Phase 1**, the Bearer authentication token is stored in `localStorage` and managed exclusively by `src/lib/auth.ts`.
* All token access (`getToken`, `setToken`, `removeToken`, `subscribeAuth`) is isolated inside this single module.
* **Future Migration**: When upgrading to secure `httpOnly` cookies in Phase 2, only `src/lib/auth.ts` and `src/lib/api.ts` need to be changed.
* Client-side route guarding (`AuthGuard`) uses `useSyncExternalStore` and renders a neutral spinner during initial evaluation, eliminating hydration mismatches and flashes of unauthorized content.
* Any `401 Unauthorized` response immediately clears the token and redirects to `/login`.

### 2. Typed API Client (`src/lib/api.ts` & `src/lib/types.ts`)
* A lightweight, centralized API client wraps standard `fetch`.
* Automatically attaches `Authorization: Bearer <token>` to protected endpoints.
* Normalizes error responses:
  * Converts 422 validation error arrays (`{ loc, msg }[]`) into clean, readable text.
  * Formats 409 conflict messages into helpful user guidance (e.g., when a step is already running or a channel name already exists).

### 3. Data Fetching & Smart Polling (TanStack Query)
* In `/videos/[id]`, TanStack Query dynamically checks step statuses:
  ```ts
  refetchInterval: (query) => {
    const steps = query.state.data?.steps || [];
    return steps.some((s) => s.status === "running") ? 2000 : false;
  }
  ```
* Polls every 2 seconds **only while** any step has status `running`. Once no steps are running, polling stops completely.
* Actions like `start`, `next`, `run-all`, and `rerun` trigger immediate cache invalidations.

---

## Daily Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server on port 3000 |
| `npm run build` | Builds the optimized production bundle |
| `npm run start` | Runs the production build server |
| `npm run lint` | Runs ESLint checks |
| `npm run generate-types` | Regenerates TypeScript definitions from `openapi.json` |

---

## Regenerating API Types

The frontend types can be derived directly from the FastAPI backend's OpenAPI contract:

1. Ensure the backend is running (`http://localhost:8000`).
2. Fetch the latest schema:
   ```bash
   curl -s http://localhost:8000/openapi.json > openapi.json
   ```
3. Run the generator:
   ```bash
   npm run generate-types
   ```
This updates `src/lib/api-types.ts`.

---

## Testing the Real Script Step

In the backend repository's `.env` (`shorts-studio-backend/.env`):
```env
LLM_PROVIDER_SCRIPT=openai
LLM_MODEL_SCRIPT=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

* When configured, the **Script** step calls the real OpenAI provider and returns real structured JSON (title, hook, narration, angle, hashtags, claims to verify, warnings, and generation meta).
* The remaining pipeline steps (Storyboard, Images, Voiceover, Render) will execute as fast mocks and display a distinct **Mock** badge in the UI.

---

## Project Structure Overview

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx       # Form-urlencoded login to /api/auth/login
│   │   └── register/page.tsx    # User registration (min 8 chars) & auto-login
│   ├── channels/
│   │   ├── page.tsx             # Channel grid + Create Channel modal
│   │   └── [id]/page.tsx        # Channel videos list + Create Video modal
│   ├── videos/
│   │   └── [id]/page.tsx        # Video detail + 5-step timeline + download
│   ├── layout.tsx               # Root layout with QueryClient & Navbar
│   ├── page.tsx                 # Client redirect to /channels or /login
│   └── globals.css              # Clean Tailwind styling
├── components/
│   ├── AuthGuard.tsx            # Route guard with neutral loading state
│   ├── CollapsibleJson.tsx      # Formatted JSON viewer with "Mock" badge
│   ├── Navbar.tsx               # Header with user email & logout
│   ├── RerunModal.tsx           # Step rerun dialog with stale step warning
│   ├── ScriptOutputView.tsx     # Rich script card (word count, hook, tags, meta)
│   ├── StepCard.tsx             # Step card (status badge, live timer, stuck alert)
│   └── StepTimeline.tsx         # Vertical pipeline connecting line
└── lib/
    ├── api.ts                   # Centralized typed fetch client & error handler
    ├── api-types.ts             # Auto-generated OpenAPI schema types
    ├── auth.ts                  # Isolated localStorage token manager
    ├── query-client.tsx         # TanStack Query client & React Provider
    └── types.ts                 # Clean domain interfaces & step contracts
```
