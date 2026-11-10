import asyncio
import json
import re
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.core.config import get_settings
from app.core.context import LocalContext, local_context
from app.models import Message, Thread
from app.schemas.api import ChatRequest
from app.services.chargers import find_chargers, geocode_explicit_place
from app.services.llm import SYSTEM_PROMPT, ollama_stream, parse_text_tool_call
from app.services.trip_planner import plan_ev_trip

router = APIRouter(prefix="/api/chat", tags=["chat"])

WORD_NUMS: dict[str, int] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "fifteen": 15, "twenty": 20, "twenty five": 25, "twenty-five": 25,
    "thirty": 30, "forty": 40, "fifty": 50,
}


def extract_distance(text: str) -> float | None:
    m = re.search(r'(?:within|under|around|radius\s*(?:of)?\s*)?\s*(\d+(?:\.\d+)?)\s*(km|kms|kilometers?|kilometres?|miles?)\b', text, re.IGNORECASE)
    if m:
        val = float(m.group(1))
        unit = m.group(2).lower()
        if "mile" in unit:
            val *= 1.60934
        return min(max(round(val, 1), 1.0), 50.0)
    m = re.search(r'\b(?:within|under|radius\s*(?:of)?)\s+(\d+(?:\.\d+)?)\b', text, re.IGNORECASE)
    if m:
        return min(max(round(float(m.group(1)), 1), 1.0), 50.0)
    for word, num in WORD_NUMS.items():
        if re.search(rf'\b(?:within|under|radius\s*(?:of)?)\s+{word}\b', text, re.IGNORECASE) or re.search(rf'\b{word}\s*(?:km|kms|kilometers?)\b', text, re.IGNORECASE):
            return float(num)
    return None


def extract_city(text: str) -> str | None:
    cleaned = re.sub(r'\b(?:within|under|radius\s*(?:of)?)\s*\d+(?:\.\d+)?\s*(?:km|kms|kilometers?|kilometres?|miles?)?\b', '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b\d+(?:\.\d+)?\s*(?:km|kms|kilometers?|kilometres?|miles?)\b', '', cleaned, flags=re.IGNORECASE)
    for word in WORD_NUMS:
        cleaned = re.sub(rf'\b(?:within|under)\s+{word}\s*(?:km|kilometers?)?\b', '', cleaned, flags=re.IGNORECASE)
    m = re.search(r'\b(?:in|near|at|around)\s+([a-zA-Z\s]+?)(?:[.,?!]|$)', cleaned, re.IGNORECASE)
    if m:
        candidate = m.group(1).strip()
        candidate = re.sub(r'\b(?:the|area|city|station|stations|chargers?|ev|fast|cheap|please)\b', '', candidate, flags=re.IGNORECASE).strip()
        if len(candidate) >= 2:
            return candidate
    return None


def parse_trip_intent(text: str) -> dict[str, Any] | None:
    m = re.search(r'\b(?:from\s+)?([a-zA-Z\s]+?)\s+(?:to|towards)\s+([a-zA-Z\s]+?)(?:\s+(?:in|with|by|car|vehicle|range|using|\d|\()|$)', text, re.IGNORECASE)
    if not m:
        return None
    origin = m.group(1).strip()
    dest = m.group(2).strip()
    for prefix in ['plan a trip', 'plan trip', 'trip', 'plan', 'i want to go to', 'i want to go', 'go to', 'go', 'drive to', 'drive', 'travel to', 'travel']:
        if origin.lower().startswith(prefix):
            origin = origin[len(prefix):].strip()
    origin = re.sub(r'^(?:from|between)\s+', '', origin, flags=re.IGNORECASE).strip()
    dest = re.sub(r'\b(?:in|with|by|car|vehicle|range|using|\d|\().*$', '', dest, flags=re.IGNORECASE).strip()
    if len(origin) < 2 or len(dest) < 2 or origin.lower() == dest.lower():
        return None
    car = None
    car_match = re.search(r'\b(?:in|with|car|vehicle)\s+(?:my\s+)?([a-zA-Z0-9\s]+?)(?:\s+(?:with|having|range|\d+|\()|$)', text, re.IGNORECASE)
    if car_match:
        cand = car_match.group(1).strip()
        if not any(cand.lower().startswith(w) for w in ['from', 'to', 'range']):
            car = cand
    rng = None
    rng_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:km|kms|kilometers?)', text, re.IGNORECASE)
    if not rng_match:
        rng_match = re.search(r'\brange\s*(?:of|is|:)?\s*(\d+(?:\.\d+)?)', text, re.IGNORECASE)
    if rng_match:
        rng = float(rng_match.group(1))

    soc = None
    soc_m = re.search(r'(?:starting\s*(?:at|with)?|battery\s*(?:at|is)?|soc\s*(?:at|is)?)\s*(\d+(?:\.\d+)?)\s*%', text, re.IGNORECASE)
    if not soc_m:
        soc_m = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(?:battery|charge|soc)', text, re.IGNORECASE)
    if soc_m:
        soc = float(soc_m.group(1))

    return {"origin": origin, "destination": dest, "car": car, "range": rng, "initial_soc": soc}


def event(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n\n"


@router.post("/stream")
async def stream_chat(body: ChatRequest, auth: LocalContext = Depends(local_context)):
    session = auth.session
    thread_result = await session.execute(select(Thread).where(Thread.id == body.thread_id, Thread.user_id == auth.profile.id))
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        thread = Thread(id=body.thread_id, user_id=auth.profile.id, title=body.message.strip().splitlines()[0][:60] or "New conversation")
        session.add(thread)
        await session.commit()
        await session.refresh(thread)

    prior_user = await session.scalar(select(Message).where(Message.thread_id == thread.id, Message.user_id == auth.profile.id, Message.request_id == body.request_id))
    if prior_user:
        previous_assistant = await session.scalar(select(Message).where(Message.thread_id == thread.id, Message.user_id == auth.profile.id, Message.role == "assistant", Message.request_id == body.request_id))
        if previous_assistant:
            async def replay() -> AsyncIterator[str]:
                yield event({"type": "message_start"})
                for part in previous_assistant.parts:
                    if part.get("type") == "text":
                        yield event({"type": "text_delta", "text": part.get("text", "")})
                    elif part.get("type") == "tool_result":
                        yield event(part)
                yield event({"type": "message_complete", "message": {"id": str(previous_assistant.id), "role": "assistant", "parts": previous_assistant.parts, "created_at": previous_assistant.created_at.isoformat()}})
            return StreamingResponse(replay(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
    else:
        user_message = Message(
            thread_id=thread.id, user_id=auth.profile.id, role="user", request_id=body.request_id,
            parts=[{"type": "text", "text": body.message}],
        )
        session.add(user_message)
        if thread.title == "New chat":
            thread.title = body.message.strip().splitlines()[0][:60] or "New chat"
        thread.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(thread)

    history_rows = await session.scalars(select(Message).where(Message.thread_id == thread.id, Message.user_id == auth.profile.id).order_by(Message.created_at).limit(60))
    conversation: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for row in history_rows:
        if row.role in {"user", "assistant"}:
            content = "\n".join(part.get("text", "") for part in row.parts if part.get("type") == "text")
            if row.role == "assistant":
                for part in row.parts:
                    if part.get("type") == "tool_result":
                        content += f"\nEarlier verified charger data: {json.dumps(part.get('stations', []), ensure_ascii=False)}"
            conversation.append({"role": row.role, "content": content})
    current_message = conversation[-1]
    if body.location:
        current_message["content"] += f"\nValidated browser location: latitude={body.location.latitude}, longitude={body.location.longitude}. Use these coordinates only for this search."
    tool_enabled = True
    profile_id = auth.profile.id
    thread_id = thread.id

    async def generate() -> AsyncIterator[str]:
        full_text = ""
        saved_parts: list[dict[str, Any]] = []
        yield event({"type": "message_start"})
        try:
            for iteration in range(get_settings().ollama_tool_iterations + 1):
                tool_calls: list[dict[str, Any]] = []
                assistant_content = ""
                streamed_length = 0
                async for chunk in ollama_stream(conversation, tool_enabled and iteration < get_settings().ollama_tool_iterations):
                    message = chunk.get("message") or {}
                    text_delta = message.get("content") or ""
                    if text_delta:
                        assistant_content += text_delta
                        if iteration > 0 and assistant_content.strip() and not assistant_content.lstrip().startswith(("{", "```")):
                            visible_delta = assistant_content[streamed_length:]
                            if visible_delta:
                                full_text += visible_delta
                                yield event({"type": "text_delta", "text": visible_delta})
                                streamed_length = len(assistant_content)
                    if message.get("tool_calls"):
                        tool_calls.extend(message["tool_calls"])
                    if chunk.get("error"):
                        raise RuntimeError("The local AI model returned an error.")

                text_tool_call = None
                if not tool_calls and iteration < get_settings().ollama_tool_iterations:
                    text_tool_call = parse_text_tool_call(assistant_content)
                    if text_tool_call:
                        tool_calls.append(text_tool_call)

                # Fallback autonomous intent extraction if LLM didn't produce a tool call
                if not tool_calls and iteration == 0:
                    trip_data = parse_trip_intent(body.message)
                    if trip_data and trip_data.get("origin") and trip_data.get("destination"):
                        tool_calls.append({
                            "function": {
                                "name": "plan_ev_trip",
                                "arguments": {
                                    "origin": trip_data["origin"],
                                    "destination": trip_data["destination"],
                                    "car_name": trip_data.get("car"),
                                    "range_km": trip_data.get("range"),
                                    "initial_soc_pct": trip_data.get("initial_soc") or 95.0,
                                }
                            }
                        })
                    elif any(k in body.message.lower() for k in ["charger", "charging", "station", "plug", "ccs", "kwh"]):
                        tool_calls.append({
                            "function": {
                                "name": "find_chargers",
                                "arguments": {
                                    "distance": extract_distance(body.message) or 10.0,
                                    "location_query": extract_city(body.message),
                                }
                            }
                        })

                if not tool_calls:
                    if assistant_content and not text_tool_call and streamed_length < len(assistant_content):
                        visible_delta = assistant_content[streamed_length:]
                        full_text += visible_delta
                        yield event({"type": "text_delta", "text": visible_delta})
                    if assistant_content and not text_tool_call:
                        saved_parts.append({"type": "text", "text": assistant_content})
                    break

                conversation.append({"role": "assistant", "content": assistant_content, "tool_calls": tool_calls})

                for call in tool_calls:
                    function = call.get("function", {})
                    fn_name = function.get("name")
                    arguments = function.get("arguments") or {}
                    if isinstance(arguments, str):
                        try:
                            arguments = json.loads(arguments)
                        except Exception:
                            arguments = {}

                    if fn_name == "plan_ev_trip":
                        origin = arguments.get("origin") or ""
                        destination = arguments.get("destination") or ""
                        car_name = arguments.get("car_name")
                        range_km = arguments.get("range_km")
                        initial_soc = arguments.get("initial_soc_pct")

                        # Sanitize initial_soc: battery % can never exceed 100%
                        if initial_soc is not None:
                            try:
                                initial_soc = float(initial_soc)
                                if initial_soc > 100.0 or initial_soc < 5.0:
                                    initial_soc = None
                            except Exception:
                                initial_soc = None

                        # Fallback parsing from user message if missing or invalid
                        t_data = parse_trip_intent(body.message)
                        if t_data:
                            origin = origin or t_data.get("origin", "")
                            destination = destination or t_data.get("destination", "")
                            car_name = car_name or t_data.get("car")
                            if range_km is None:
                                range_km = t_data.get("range")
                            if initial_soc is None:
                                initial_soc = t_data.get("initial_soc")
                        if initial_soc is None:
                            initial_soc = 95.0

                        yield event({"type": "tool_call", "tool": "plan_ev_trip", "status": f"Calculating highway route from {origin} to {destination}..."})
                        try:
                            plan = await plan_ev_trip(
                                origin=origin,
                                destination=destination,
                                car_name=car_name,
                                range_km=range_km,
                                initial_soc_pct=float(initial_soc),
                            )
                            station_data = [s["station"] for s in plan.get("stops", [])]
                            tool_part = {
                                "type": "tool_result",
                                "tool": "plan_ev_trip",
                                "trip_plan": plan,
                                "stations": station_data,
                            }
                            saved_parts.append(tool_part)
                            yield event(tool_part)
                            summary_msg = (
                                f"Trip Planned: {plan['origin']} to {plan['destination']} for {plan['car_name']}. "
                                f"Total distance: {plan['total_distance_km']} km, {plan['stops_count']} charging stop(s) required "
                                f"(total ~{plan['total_charging_mins']} mins charging, est. ₹{plan['total_charging_cost_inr']:.0f})."
                            )
                            conversation.append({
                                "role": "tool",
                                "content": json.dumps({"summary": summary_msg, "plan": plan}, ensure_ascii=False),
                                "tool_name": "plan_ev_trip",
                            })
                        except Exception as e:
                            err_part = {"type": "tool_result", "tool": "plan_ev_trip", "error": str(e), "stations": []}
                            saved_parts.append(err_part)
                            yield event(err_part)
                            conversation.append({"role": "tool", "content": json.dumps({"error": str(e)}), "tool_name": "plan_ev_trip"})

                    elif fn_name == "find_chargers":
                        yield event({"type": "tool_call", "tool": "find_chargers", "status": "Searching live station data"})
                        req_dist = arguments.get("distance")
                        if not req_dist:
                            req_dist = extract_distance(body.message) or 10.0
                        else:
                            try:
                                req_dist = float(req_dist)
                            except Exception:
                                req_dist = 10.0

                        coordinates = (body.location.latitude, body.location.longitude) if body.location else None
                        if coordinates is None and arguments.get("location_query"):
                            loc_cand = re.sub(r'\b(?:within|under|radius\s*(?:of)?)\s*\d+(?:\.\d+)?\s*(?:km|kms|kilometers?|kilometres?|miles?)?\b', '', arguments["location_query"], flags=re.IGNORECASE).strip()
                            coordinates = await geocode_explicit_place(loc_cand or arguments["location_query"])
                        if coordinates is None and not body.location:
                            city_candidate = extract_city(body.message)
                            if city_candidate:
                                coordinates = await geocode_explicit_place(city_candidate)

                        if coordinates is None:
                            tool_part = {"type": "tool_result", "tool": "find_chargers", "stations": [], "error": "No explicit, resolvable location is available. Ask the user to enable device location or enter a more specific place."}
                            saved_parts.append(tool_part)
                            yield event(tool_part)
                            conversation.append({"role": "tool", "content": json.dumps({"error": tool_part["error"]}), "tool_name": "find_chargers"})
                            continue

                        result = await find_chargers(
                            latitude=coordinates[0], longitude=coordinates[1],
                            distance=req_dist, maxresults=arguments.get("maxresults") or 10,
                            connector_types=arguments.get("connector_types") if isinstance(arguments.get("connector_types"), list) else None,
                            min_power_kw=arguments.get("min_power_kw"),
                            max_price_per_kwh=arguments.get("max_price_per_kwh"),
                            max_price_currency=arguments.get("max_price_currency"),
                        )
                        station_data = result["stations"]
                        tool_part = {"type": "tool_result", "tool": "find_chargers", "stations": station_data, "pricing_filter_note": result.get("pricing_filter_note"), "source": result["source"], "retrieved_at": result["retrieved_at"]}
                        saved_parts.append(tool_part)
                        yield event(tool_part)
                        conversation.append({"role": "tool", "content": json.dumps(result, ensure_ascii=False), "tool_name": "find_chargers"})
                    else:
                        raise RuntimeError(f"The model requested an unsupported tool: {fn_name}")

                if iteration >= get_settings().ollama_tool_iterations:
                    break

            if not saved_parts and full_text:
                saved_parts.append({"type": "text", "text": full_text})
            assistant = Message(thread_id=thread_id, user_id=profile_id, role="assistant", request_id=body.request_id, parts=saved_parts)
            session.add(assistant)
            owned = await session.get(Thread, thread_id)
            if owned:
                owned.updated_at = datetime.now(UTC)
            await session.commit()
            yield event({"type": "message_complete", "message": {"id": str(assistant.id), "role": "assistant", "parts": saved_parts, "created_at": assistant.created_at.isoformat()}})
        except Exception as error:
            await session.rollback()
            yield event({"type": "error", "detail": str(error)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
