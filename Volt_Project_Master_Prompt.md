# Volt — Full Project Master Prompt (for manual QA / correction / rebuild)

Use this as a single prompt to reproduce the entire project, or as a checklist to manually verify an existing implementation. Sections 1–9 describe WHAT to build; Section 10 is the QA checklist to correct against.

---

## 1. Role & Goal

You are an expert full-stack engineer. Build **Volt**, an NLP-driven conversational agent (chat copilot) that helps EV drivers discover electric-vehicle charging stations near them using natural language. The driver types things like *"find fast chargers near me under ₹20/kWh"* and Volt replies conversationally with real, live station data — names, distances, connector types, max power, operator details, and price per kWh.

Non-negotiables:
- Multi-thread chat with persistent history in a local single-user profile.
- Real device geolocation, not city-name guessing.
- Live third-party station data (Open Charge Map API), not a static dataset.
- Streaming AI responses (token-by-token) with tool calling.
- No sign-in or OAuth; keep the local-only app bound to localhost.

## 2. Tech Stack (exact)

| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 (full-stack React, file-based routing, server functions), Vite 7 |
| UI | React 19 + TypeScript, Tailwind CSS v4 (CSS-first `@theme` tokens), shadcn/ui components |
| Routing | TanStack Router (file-based; chat routes are public for local use) |
| Data fetching | TanStack Query (`useSuspenseQuery` + loaders) |
| Backend / DB | Local FastAPI + SQLite; one local profile and no authentication |
| AI | AI SDK v5+ (`ai` package: `streamText`, `tool`, `convertToModelMessages`), OpenAI-compatible provider pointed at the Lovable AI Gateway, model `google/gemini-3.5-flash` |
| External data | Open Charge Map POI API v3 (`https://api.openchargemap.io/v3/poi`) |
| Validation | Zod (server-function input schemas, tool input schema) |
| Auth | None — no sign-in, OAuth, or bearer tokens |

## 3. Pages & Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page: hero, feature bullets, "Start chatting" CTA → app |
| `/app` | Public | Redirects to the most recent thread (or creates one) |
| `/app/$threadId` | Public | The chat: sidebar (thread list), message stream, composer, geolocation capture |
| `/app/$threadId/compare` | Public | Price-comparison page for every charger found in that thread |

There is no authentication guard; this app is intended for localhost use only.
Root layout (`__root.tsx`) renders the shell + a single `<Toaster />` (sonner).

## 4. Database Schema

SQLite stores one local profile and its threads/messages. There is no per-user access control; bind the app to localhost and do not expose it to an untrusted network:

- **`threads`**: `id uuid pk default gen_random_uuid()`, `user_id uuid not null`, `title text default 'New chat'`, `created_at`, `updated_at` (timestamptz, defaults `now()`).
- **`messages`**: `id uuid pk default gen_random_uuid()`, `thread_id uuid fk → threads(id) on delete cascade`, `user_id uuid not null`, `role text` (`'user' | 'assistant'`), `parts jsonb not null` (AI SDK message parts, so tool calls render on reload), `created_at`.

The local profile is created automatically on the first API request.

## 5. Backend Logic

### 5.1 Thread/message server functions (`src/lib/threads.functions.ts`)
Thread operations use the local profile context; there is no auth middleware or client token injection:
- `listThreads()` — GET, newest by `updated_at`.
- `createThread({title?})` — POST.
- `deleteThread({id})`, `renameThread({id,title})` — POST, Zod-validated UUID/title.
- `getThreadMessages({threadId})` — GET, returns `{id, role, parts}` ordered by time; used to rehydrate a thread on reload.

### 5.2 Streaming chat route (`src/routes/api/chat.ts`)
`POST /api/chat` — a TanStack file route with a `server` handler:
1. Parse body `{ messages: UIMessage[], threadId }` → 400/404 checks.
2. **Persist the latest user message** (role `user`, full `parts` JSON). If the thread is still titled "New chat", auto-title it from the first 60 chars of the user's text.
5. Call `streamText` with model `google/gemini-3.5-flash` via the gateway provider, a Volt system prompt (concise, friendly EV-charging expert; ranks by distance; highlights ≥50 kW fast chargers; quotes price per kWh; estimates session cost from battery size; suggests widening radius when empty).
6. **Tool: `find_chargers`** with Zod input `{latitude, longitude, distance (1–50 km, default 10), maxresults (1–25, default 10)}`. Executes a fetch to Open Charge Map and returns per station:
   `id, name, address, latitude, longitude, distance_km, operator, operator_website, operator_phone, usage_cost (raw tariff text), price_per_kwh (parsed number), connections[] ({type, power_kw, level, quantity, current_type}), connector_types[], max_power_kw`.
   Price parsing: regex on `usage_cost` for patterns like `€0.35/kWh`, `$0.40 per kWh`, `INR 18 per kWh` → numeric per-kWh value or null.
7. `stopWhen: stepCountIs(50)` so the model can chain multiple tool calls.
8. Return `result.toUIMessageStreamResponse(...)`; in `onFinish`, **persist the assistant message** (parts JSON) and bump `threads.updated_at`.

API keys (`LOVABLE_API_KEY`, Supabase env) are read only server-side from `process.env` inside the handler — never shipped to the browser.

## 6. Chat UI (`/app/$threadId`)

- **Sidebar**: thread list (rename inline, delete with confirm), active-thread highlight, "New chat" button.
- **Messages**: user bubbles and assistant replies rendered from AI SDK parts; `tool-find_chargers` parts render as **charger result cards** — station name, distance, address, connector badges (e.g. CCS, Type 2, CHAdeMO), max power kW, price-per-kWh badge (or raw tariff text), operator name linking to their website.
- **Streaming**: consume the `/api/chat` stream with the AI SDK chat hook; show a typing indicator; optimistic user message.
- **Geolocation**: a "Use my location" control calls `navigator.geolocation.getCurrentPosition`; the resolved lat/lng is attached (silently) to the next user message so the model can call the tool with real coordinates. Handle denied permission gracefully (ask the user to type a city instead).
- **Header**: link/button to the compare page for this thread.

## 7. Compare Page (`/app/$threadId/compare`)

- Loads the thread's messages server-side, extracts every station the `find_chargers` tool ever returned in that conversation (dedup by station id).
- Table/cards sorted by price per kWh ascending; **"Cheapest"** badge on the lowest price; re-sort controls (price / distance / power).
- Columns: station, price per kWh (or tariff text), distance, connector types, max power, operator (linked).
- Empty state: "No chargers found yet — ask Volt first."

## 8. Design System

Dark, "electric" identity: deep midnight background (`#0A0E1A`-range), electric-green primary accent, subtle glow on interactive elements, rounded cards, consistent shadcn tokens defined in `src/styles.css` `@theme` — no hardcoded colors in components. Distinctive headline font pairing; app-specific page titles/descriptions in every route's `head()`.

## 9. Local-Only Use & Edge Cases

- No authentication is provided. Bind frontend and backend to localhost; do not expose the app to a network.
- The local profile owns all threads/messages in the SQLite database.
- Tool inputs clamped server-side (radius ≤ 50 km, results ≤ 25).
- Graceful states: geolocation denied, empty thread list, empty tool results, network/API errors surfaced as a toast + inline retry.

## 10. QA / Correction Checklist

1. Visit `/app` without signing in — a local chat thread opens.
3. Sending "Find chargers near me" (location granted) produces station cards with distance + connectors + power.
4. Asking "which is cheapest per kWh?" returns per-kWh prices or an honest "pricing unknown" with operator contact.
5. Reload the page mid-conversation: full history including charger cards is restored from the DB.
6. Thread sidebar: rename and delete reflect immediately and survive reload.
7. Compare page shows every station from that thread, cheapest first, with the badge.
8. Restart the backend — local threads remain available from SQLite.
9. No `LOVABLE_API_KEY` or service secrets appear in the browser bundle or network tab from the client.
10. Responses stream progressively rather than appearing all at once.
