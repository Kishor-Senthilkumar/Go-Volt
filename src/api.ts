export type Thread = { id: string; title: string; updated_at: string }
export type Price = { amount: number; currency: string; unit: 'kWh'; is_estimated: boolean } | null
export type Station = {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  distance_km: number
  operator: string | null
  operator_website: string | null
  operator_phone: string | null
  usage_cost: string | null
  price_per_kwh: Price
  connector_types: string[]
  max_power_kw: number | null
  data_source: string
}

export type TripStop = {
  stop_number: number
  location_name: string
  distance_from_origin_km: number
  latitude: number
  longitude: number
  battery_at_arrival_pct: number
  charge_to_pct: number
  kwh_added: number
  estimated_charge_mins: number
  estimated_cost_inr: number
  station: Station
  amenity: string
}

export type TripPlan = {
  origin: string
  origin_coords: [number, number]
  destination: string
  destination_coords: [number, number]
  car_name: string
  car_range_km: number
  battery_kwh: number
  initial_soc_pct: number
  destination_arrival_soc_pct: number
  total_distance_km: number
  estimated_drive_hours: number
  total_trip_hours: number
  stops_count: number
  total_charging_mins: number
  total_charging_cost_inr: number
  co2_saved_kg: number
  stops: TripStop[]
}

export type EVPreset = {
  name: string
  battery_kwh: number
  range_km: number
  max_dc_kw: number
  connector: string
}

export type MessagePart = {
  type: string
  text?: string
  stations?: Station[]
  trip_plan?: TripPlan
  status?: string
  tool?: string
}

export type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; parts: MessagePart[]; created_at: string }
export type Profile = { display_name: string | null; email: string | null; avatar_url: string | null }

const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiBase}${path}`, { ...init, headers })
  if (response.status === 204) return undefined as T
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(detail.detail ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const api = {
  me: () => request<Profile>('/api/me'),
  threads: () => request<Thread[]>('/api/threads'),
  createThread: () => request<Thread>('/api/threads', { method: 'POST', body: '{}' }),
  renameThread: (id: string, title: string) => request<Thread>(`/api/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteThread: (id: string) => request<void>(`/api/threads/${id}`, { method: 'DELETE' }),
  messages: (id: string) => request<ChatMessage[]>(`/api/threads/${id}/messages`),
  stations: (id: string) => request<Station[]>(`/api/threads/${id}/stations`),
  getTripPresets: () => request<{ presets: EVPreset[] }>('/api/trip/presets'),
  planTrip: (payload: { origin: string; destination: string; car_name?: string; range_km?: number; initial_soc_pct?: number }) =>
    request<TripPlan>('/api/trip/plan', { method: 'POST', body: JSON.stringify(payload) }),
}

export async function streamChat(input: {
  thread_id: string
  message: string
  location?: { latitude: number; longitude: number }
  request_id: string
  onText: (text: string) => void
  onStations: (stations: Station[]) => void
  onTripPlan?: (plan: TripPlan) => void
  onComplete: (message: ChatMessage) => void
}) {
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' })
  const response = await fetch(`${apiBase}/api/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ thread_id: input.thread_id, message: input.message, location: input.location, request_id: input.request_id }),
  })
  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => ({ detail: 'Could not start the response.' }))
    throw new Error(detail.detail)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const block of events) {
      const event = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6)
      if (!event) continue
      const payload = JSON.parse(event) as {
        type: string
        text?: string
        stations?: Station[]
        trip_plan?: TripPlan
        message?: ChatMessage
        detail?: string
      }
      if (payload.type === 'text_delta' && payload.text) input.onText(payload.text)
      if (payload.type === 'tool_result') {
        if (payload.stations) input.onStations(payload.stations)
        if (payload.trip_plan && input.onTripPlan) input.onTripPlan(payload.trip_plan)
      }
      if (payload.type === 'message_complete' && payload.message) input.onComplete(payload.message)
      if (payload.type === 'error') throw new Error(payload.detail ?? 'The assistant could not finish this response.')
    }
  }
}
