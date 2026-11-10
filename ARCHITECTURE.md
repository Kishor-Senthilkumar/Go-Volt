# 1.1 System Architecture

```mermaid
flowchart LR
    User[User]
    Browser[Browser<br/>React + TypeScript<br/>Vite]
    Proxy[Vite dev proxy<br/>/api and /health]
    API[FastAPI backend<br/>Threads, messages, chat stream]
    Context[Local profile context]
    DB[(SQLite<br/>threads, messages, profile)]
    Chat[Chat orchestration<br/>SSE response stream]
    LLM[Ollama<br/>llama3.2:3b]
    Charger[Charger search service<br/>normalize and filter stations]
    OCM[Open Charge Map API]
    Geo[Optional geocoding service]
    Location[Browser geolocation<br/>user permission]

    User --> Browser
    Browser -->|Chat, thread, profile requests| Proxy
    Proxy -->|HTTP| API
    API --> Context
    Context <--> DB
    API --> Chat
    Chat <-->|Local model request and streamed tokens| LLM
    Chat -->|Search by coordinates and filters| Charger
    Charger <-->|Live charging station data| OCM
    Charger -.->|Resolve explicitly named place when configured| Geo
    Location -->|Coordinates with permission| Browser
    Browser <-->|Server-sent events: text and station results| Proxy
```

## Request flow

1. The user enters a message in the React frontend. For nearby searches, the browser can provide coordinates after the user grants location permission.
2. The frontend sends chat requests through the Vite `/api` proxy to FastAPI. Chat responses stream back as server-sent events.
3. FastAPI loads the local conversation context from SQLite and sends the conversation to the configured Ollama model.
4. When a live charger lookup is needed, the backend queries Open Charge Map and returns normalized station results to the frontend.
5. FastAPI saves messages and station results in SQLite so they can be shown again in the conversation.

The optional geocoding service can resolve a place explicitly named by the user when configured. The current charger lookup searches around one location; it does not calculate a driving route or find chargers along a route.
