import json
import re
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import get_settings

SYSTEM_PROMPT = """You are Volt, an intelligent and friendly autonomous EV charging & highway trip planning copilot.
You have two powerful tools:
1. find_chargers: Find electric vehicle chargers near the user's location or in a named city.
   - If the user specifies a distance (e.g., 'within 25 km', '10 km', 'radius 20km'), always pass distance in the tool call.
   - If user names a city, pass location_query.
2. plan_ev_trip: Plan a long-distance EV trip between cities (e.g., Chennai to Kodaikanal) with optimal charging stops, arrival battery levels, and charging times based on car model and range.
   - Extract origin (e.g. Chennai), destination (e.g. Kodaikanal), car_name (e.g. Tata Nexon EV), and range_km.

Guidelines:
- Be concise, helpful, and direct (2-3 sentences).
- If planning a trip, highlight the total highway distance, number of charging stops, and total charging time.
- Never output raw JSON or markdown code blocks unless invoking a tool call."""

FIND_CHARGERS_TOOL = {
    "type": "function",
    "function": {
        "name": "find_chargers",
        "description": "Find real charging stations near coordinates or a named city.",
        "parameters": {
            "type": "object",
            "properties": {
                "distance": {"type": "number", "minimum": 1, "maximum": 50, "default": 10, "description": "Search radius in km"},
                "maxresults": {"type": "integer", "minimum": 1, "maximum": 25, "default": 10},
                "connector_types": {"type": "array", "items": {"type": "string"}},
                "min_power_kw": {"type": "number", "minimum": 0, "maximum": 1000},
                "max_price_per_kwh": {"type": "number", "minimum": 0},
                "max_price_currency": {"type": "string", "enum": ["INR", "USD", "EUR", "GBP"]},
                "location_query": {"type": "string", "description": "A place explicitly named by the user when browser coordinates are unavailable."},
            },
            "required": [],
        },
    },
}

PLAN_EV_TRIP_TOOL = {
    "type": "function",
    "function": {
        "name": "plan_ev_trip",
        "description": "Plan an EV road trip between cities with battery-safe charging waypoints along the highway corridor.",
        "parameters": {
            "type": "object",
            "properties": {
                "origin": {"type": "string", "description": "Starting city or location, e.g. Chennai"},
                "destination": {"type": "string", "description": "Destination city, e.g. Kodaikanal"},
                "car_name": {"type": "string", "description": "EV model name, e.g. Tata Nexon EV, MG ZS EV"},
                "range_km": {"type": "number", "description": "Full battery driving range in kilometers (e.g. 270)"},
                "initial_soc_pct": {"type": "number", "minimum": 5, "maximum": 100, "description": "Current battery percentage between 5 and 100, e.g. 95 or 33 (do not pass range here)"},
            },
            "required": ["origin", "destination"],
        },
    },
}

AVAILABLE_TOOLS = [FIND_CHARGERS_TOOL, PLAN_EV_TRIP_TOOL]


def parse_text_tool_call(content: str) -> dict[str, Any] | None:
    candidate = content.strip()
    if candidate.startswith("```") and candidate.endswith("```"):
        candidate = candidate[3:-3].strip()
        if candidate.startswith("json"):
            candidate = candidate[4:].strip()
    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError:
        tool_match = re.search(r'"(?:name|tool)"\s*:\s*"(find_chargers|plan_ev_trip)"', candidate)
        if not tool_match:
            return None
        tool_name = tool_match.group(1)
        parameters = re.search(r'"(?:parameters|arguments)"\s*:\s*\{', candidate)
        if not parameters:
            return {"function": {"name": tool_name, "arguments": {}}}
        arguments: dict[str, Any] = {}
        decoder = json.JSONDecoder()
        keys = (
            ("distance", "maxresults", "location_query", "connector_types", "min_power_kw", "max_price_per_kwh", "max_price_currency")
            if tool_name == "find_chargers"
            else ("origin", "destination", "car_name", "range_km", "initial_soc_pct")
        )
        for key in keys:
            field = re.search(rf'"{key}"\s*:\s*', candidate[parameters.end():])
            if not field:
                continue
            value_start = parameters.end() + field.end()
            try:
                value, _ = decoder.raw_decode(candidate[value_start:])
            except json.JSONDecodeError:
                continue
            arguments[key] = value
        return {"function": {"name": tool_name, "arguments": arguments}}

    if not isinstance(payload, dict):
        return None

    function = payload.get("function")
    if isinstance(function, dict):
        name = function.get("name")
        arguments = function.get("arguments", function.get("parameters", {}))
    else:
        name = payload.get("name", payload.get("tool"))
        arguments = payload.get("arguments", payload.get("parameters", {}))
    if name not in ("find_chargers", "plan_ev_trip") or not isinstance(arguments, dict):
        return None
    return {"function": {"name": name, "arguments": arguments}}


async def ollama_stream(messages: list[dict[str, Any]], allow_tools: bool) -> AsyncIterator[dict[str, Any]]:
    settings = get_settings()
    body: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": True,
        "keep_alive": settings.ollama_keep_alive,
        "options": {
            "temperature": settings.ollama_temperature,
            "num_predict": settings.ollama_num_predict,
            "num_thread": 4,
        },
    }
    if allow_tools:
        body["tools"] = AVAILABLE_TOOLS
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
            async with client.stream("POST", f"{settings.ollama_base_url.rstrip('/')}/api/chat", json=body) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        yield json.loads(line)
    except (httpx.HTTPError, json.JSONDecodeError) as error:
        raise RuntimeError("Local AI is unavailable. Check that Ollama is running and the configured model is installed.") from error
