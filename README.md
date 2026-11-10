# Volt — EV Charging Assistant

A fast, local AI assistant for finding EV charging stations using live Open Charge Map data.

**No Docker required.** Runs entirely on your machine with SQLite and a local Ollama model.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (TypeScript) |
| Backend | FastAPI (Python 3.12+) |
| Database | SQLite (auto-created on first run) |
| AI Model | Ollama (`llama3.2:3b` — local, private) |
| User profile | Single local profile; no sign-in required |
| Charger Data | Open Charge Map API |

---

## Prerequisites

1. **Python 3.12+** — [python.org](https://www.python.org/downloads/)
2. **Node.js 20+** — [nodejs.org](https://nodejs.org/)
3. **Ollama** — [ollama.com](https://ollama.com/) — install and run it, then pull the model:
   ```
   ollama pull llama3.2:3b
   ```
---

## Setup

### 1. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` if you want to configure optional services:
```env
OPEN_CHARGE_MAP_API_KEY=optional-key-from-openchargemap.org
OLLAMA_MODEL=llama3.2:3b
```

### 2. Install backend dependencies

```bash
cd backend
pip install -e ".[test]"
```

### 3. Start the backend

```bash
cd backend
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`. SQLite database (`volt.db`) is created automatically.

### 4. Install frontend dependencies

```bash
cd ..
npm install
```

### 5. Start the frontend

```bash
npm run dev
```

Open `http://127.0.0.1:5173` and start chatting. No sign-in or OAuth setup is required.

Volt uses one local profile and has no authentication. Keep the backend and frontend bound to localhost; do not expose this development app to an untrusted network.

For a quick demo, warm the model before opening the chat:
```powershell
ollama run llama3.2:3b "Reply with READY."
```
The backend keeps the model loaded for 30 minutes after a request and limits replies to 256 generated tokens to reduce waiting.

---

## How it works

1. Ask Volt about EV chargers (e.g., "CCS chargers within 10km of me")
2. Volt uses `llama3.2:3b` running locally via Ollama to understand your question
3. It queries the Open Charge Map API for real, live station data
4. Results are displayed as station cards you can compare

---

## Configuration

All settings are in `.env` (root) and the backend reads them via `pydantic-settings`:

| Variable | Description | Default |
|---|---|---|
| `OLLAMA_MODEL` | Ollama model name | `llama3.2:3b` |
| `OLLAMA_NUM_PREDICT` | Maximum generated tokens per model response | `256` |
| `OLLAMA_KEEP_ALIVE` | How long Ollama keeps the model loaded | `30m` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OPEN_CHARGE_MAP_API_KEY` | Open Charge Map API key | *(empty, still works)* |
| `GEOCODING_BASE_URL` | Nominatim geocoding URL | *(uses in-memory fallback)* |

---

## Troubleshooting

**"Local AI is unavailable"** — Make sure Ollama is running: `ollama serve`

**Charger data is empty** — Try a wider radius or a different city; the Open Charge Map free tier works without a key but has rate limits

---

## Development

```bash
# Run backend tests
cd backend && pytest

# Check Ollama models installed
ollama list

# Pull a different model
ollama pull phi3:mini
```

To use a different model, set `OLLAMA_MODEL=phi3:mini` in your `.env` and restart the backend.