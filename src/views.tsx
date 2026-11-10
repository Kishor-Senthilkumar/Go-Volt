import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Bolt,
  Car,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Gauge,
  LocateFixed,
  MapPin,
  Menu,
  MessageSquarePlus,
  Mic,
  MicOff,
  Pencil,
  PlugZap,
  Route,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, streamChat, type ChatMessage, type Station, type Thread, type TripPlan } from './api'
import 'leaflet/dist/leaflet.css'

function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} | Volt`
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.append(meta)
    }
    meta.content = description
  }, [title, description])
}

export function AppShell() {
  return (
    <>
      <div className="ambient-grid" />
      <div className="app-frame">
        <main>
          <div className="route-content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  )
}

export function LandingPage() {
  usePageMetadata('EV charging, clearly', 'Find and compare nearby EV charging stations and plan long-distance EV trips.')
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Bolt size={17} fill="currentColor" />
          </span>
          volt<span className="brand-period">.</span>
        </Link>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#principles">Built on trust</a>
        </div>
        <Link to="/app" className="button button-small">
          Open Volt <ArrowUpRight size={15} />
        </Link>
      </header>
      <section className="hero" id="how">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" /> THE ROAD, ELECTRIFIED
          </div>
          <h1>
            Find your
            <br />
            next <em>charge.</em>
          </h1>
          <p className="hero-lede">
            A smarter way to find the right plug, at the right price, wherever the road takes you. Now featuring autonomous Highway Trip Planning.
          </p>
          <div className="hero-actions">
            <Link to="/app" className="button button-primary">
              Start chatting <ArrowUpRight size={16} />
            </Link>
            <span className="hero-note">
              <ShieldCheck size={15} /> Your location stays yours
            </span>
          </div>
          <div className="hero-proof">
            <span className="live-dot" /> LIVE STATION & HIGHWAY DATA <span className="proof-divider" /> VERIFIED EV NETWORK
          </div>
        </div>
        <div className="hero-art" aria-label="Illustration of an electric vehicle charging">
          <div className="sun-disc" />
          <div className="road-line road-line-one" />
          <div className="road-line road-line-two" />
          <div className="charger-unit">
            <div className="charger-screen">
              <Bolt size={20} fill="currentColor" />
            </div>
            <div className="charger-port" />
            <div className="charger-leg" />
          </div>
          <div className="charging-cable" />
          <div className="vehicle">
            <div className="vehicle-window" />
            <div className="vehicle-light" />
            <div className="wheel wheel-front" />
            <div className="wheel wheel-back" />
          </div>
          <div className="map-pin-float">
            <MapPin size={15} fill="currentColor" />
            <span>4.2 km</span>
          </div>
          <div className="art-caption">
            <span>01 / FIND YOUR FIT</span>
            <span className="caption-rule" />
            <span>CHARGING, WITHOUT THE GUESSWORK</span>
          </div>
        </div>
      </section>
      <section className="principles" id="principles">
        <div className="section-intro">
          <span className="eyebrow">A BETTER KIND OF PIT STOP</span>
          <h2>
            Good energy.
            <br />
            <em>Zero guesswork.</em>
          </h2>
        </div>
        <div className="principle-list">
          <article>
            <span className="principle-icon">
              <Compass size={18} />
            </span>
            <div>
              <h3>Close to your route</h3>
              <p>Real coordinates. Real distances. We only use your location when you choose to share it.</p>
            </div>
            <span className="principle-index">01</span>
          </article>
          <article>
            <span className="principle-icon">
              <Search size={18} />
            </span>
            <div>
              <h3>Ask like a human</h3>
              <p>Plan Chennai to Kodaikanal in a Nexon EV, or find CCS plugs within 25 km.</p>
            </div>
            <span className="principle-index">02</span>
          </article>
          <article>
            <span className="principle-icon">
              <ArrowDownUp size={18} />
            </span>
            <div>
              <h3>Compare with clarity</h3>
              <p>See the price, power, connector, and charging duration all in one place.</p>
            </div>
            <span className="principle-index">03</span>
          </article>
        </div>
      </section>
      <footer className="landing-footer">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Bolt size={15} fill="currentColor" />
          </span>
          volt<span className="brand-period">.</span>
        </Link>
        <span>Made for the long way around.</span>
        <span>AUTONOMOUS EV TRIP PLANNER</span>
      </footer>
    </div>
  )
}

function ThreadSidebar({ threadId }: { threadId: string }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: threads = [] } = useQuery({ queryKey: ['threads'], queryFn: api.threads })
  const create = useMutation({
    mutationFn: api.createThread,
    onSuccess: (thread) => {
      void client.invalidateQueries({ queryKey: ['threads'] })
      void navigate({ to: '/app/$threadId', params: { threadId: thread.id } })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameThread(id, title),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['threads'] }),
  })
  const remove = useMutation({
    mutationFn: api.deleteThread,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['threads'] })
      const latest = await api.threads()
      if (latest[0]) void navigate({ to: '/app/$threadId', params: { threadId: latest[0].id } })
      else {
        const created = await api.createThread()
        void navigate({ to: '/app/$threadId', params: { threadId: created.id } })
      }
    },
  })
  return (
    <>
      <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle conversations">
        <Menu size={19} />
      </button>
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Bolt size={15} fill="currentColor" />
            </span>
            volt<span className="brand-period">.</span>
          </Link>
          <button className="icon-button sidebar-add" title="New chat" onClick={() => create.mutate()}>
            <MessageSquarePlus size={17} />
          </button>
        </div>
        <button className="new-chat-button" onClick={() => create.mutate()}>
          <span>
            <MessageSquarePlus size={15} />
          </span>{' '}
          New conversation <span className="new-key">+</span>
        </button>
        <div className="sidebar-label">
          YOUR JOURNEYS <span>{threads.length.toString().padStart(2, '0')}</span>
        </div>
        <div className="thread-list">
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              active={thread.id === threadId}
              onRename={(title) => rename.mutate({ id: thread.id, title })}
              onDelete={() => {
                if (window.confirm('Delete this conversation? This cannot be undone.')) remove.mutate(thread.id)
              }}
            />
          ))}
        </div>
        <div className="sidebar-bottom">
          <Link to="/settings" className="sidebar-setting">
            <Settings2 size={15} /> Preferences
          </Link>
        </div>
      </aside>
    </>
  )
}

function ThreadItem({
  thread,
  active,
  onRename,
  onDelete,
}: {
  thread: Thread
  active: boolean
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(thread.title)
  return (
    <div className={`thread-item ${active ? 'thread-active' : ''}`}>
      <Link to="/app/$threadId" params={{ threadId: thread.id }} className="thread-link">
        <span className="thread-marker" />
        <span className="thread-title">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                setEditing(false)
                if (title.trim()) onRename(title.trim())
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setEditing(false)
                  onRename(title.trim())
                }
              }}
              onClick={(event) => event.preventDefault()}
            />
          ) : (
            thread.title
          )}
        </span>
      </Link>
      <div className="thread-actions">
        <button title="Rename" onClick={() => setEditing(true)}>
          <Pencil size={13} />
        </button>
        <button title="Delete" onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

export function ChatPage() {
  const { threadId } = useParams({ strict: false }) as { threadId: string }
  const client = useQueryClient()
  const navigate = useNavigate()
  const { data: messages = [], isLoading, error } = useQuery({ queryKey: ['messages', threadId], queryFn: () => api.messages(threadId), retry: 1 })

  useEffect(() => {
    if (error) {
      api.threads().then((threads) => {
        if (threads.length > 0 && threads[0].id !== threadId) {
          void navigate({ to: '/app/$threadId', params: { threadId: threads[0].id } })
        } else {
          api.createThread().then((created) => {
            void navigate({ to: '/app/$threadId', params: { threadId: created.id } })
          })
        }
      }).catch(() => {})
    }
  }, [error, threadId, navigate])
  const [text, setText] = useState('')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLabel, setLocationLabel] = useState('Location off')
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [pendingUser, setPendingUser] = useState('')
  const [draftStations, setDraftStations] = useState<Station[]>([])
  const [draftTripPlan, setDraftTripPlan] = useState<TripPlan | null>(null)
  const [listening, setListening] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [showTripModal, setShowTripModal] = useState(false)
  const recognitionRef = useRef<any>(null)
  usePageMetadata('Charging copilot', 'Find EV charging stations and plan long-distance electric highway trips.')

  const toggleSpeak = (id: string, textToSpeak: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Voice playback is not supported in this browser.')
      return
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      return
    }
    window.speechSynthesis.cancel()
    const cleaned = textToSpeak
      .replace(/[*#_`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .trim()
    if (!cleaned) return
    const utterance = new SpeechSynthesisUtterance(cleaned)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(id)
    window.speechSynthesis.speak(utterance)
  }

  const toggleListening = async () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      toast.error('Voice recognition is not supported in this browser. Please open the app in Google Chrome or Microsoft Edge.')
      return
    }
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {}
      setListening(false)
      return
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        toast.error('Microphone blocked. Click the lock icon in your browser URL bar and allow Microphone.')
        return
      }
      if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        toast.error('No microphone detected on your computer.')
        return
      }
    }

    try {
      const recognition = new SpeechRec()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = navigator.language || 'en-US'
      recognition.onstart = () => {
        setListening(true)
        toast.info('Listening… speak now')
      }
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
        if (transcript) setText(transcript)
      }
      recognition.onerror = (event: any) => {
        setListening(false)
        if (event.error === 'not-allowed') {
          toast.error('Microphone access blocked. Click the lock icon in your address bar and set Microphone to Allow.')
        } else if (event.error === 'network') {
          toast.error('Voice recognition network service unavailable. Try using http://localhost:5173 or type your message.')
        } else if (event.error === 'audio-capture') {
          toast.error('No microphone detected. Check Windows Sound settings.')
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error(`Voice error: ${event.error}`)
        }
      }
      recognition.onend = () => {
        setListening(false)
      }
      recognitionRef.current = recognition
      recognition.start()
    } catch {
      toast.error('Could not start voice recognition')
      setListening(false)
    }
  }

  const send = async (value = text) => {
    const message = value.trim()
    if (!message || sending) return
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {}
      setListening(false)
    }
    setText('')
    setDraft('')
    setPendingUser(message)
    setDraftStations([])
    setDraftTripPlan(null)
    setSending(true)
    try {
      await streamChat({
        thread_id: threadId,
        message,
        location: location ?? undefined,
        request_id: crypto.randomUUID(),
        onText: (delta) => setDraft((current) => current + delta),
        onStations: setDraftStations,
        onTripPlan: setDraftTripPlan,
        onComplete: (completeMsg) => {
          if (autoSpeak && completeMsg) {
            const assistantText = completeMsg.parts?.filter((p) => p.type === 'text').map((p) => p.text).join('') ?? ''
            if (assistantText) {
              toggleSpeak(completeMsg.id, assistantText)
            }
          }
        },
      })
      await client.invalidateQueries({ queryKey: ['messages', threadId] })
      await client.invalidateQueries({ queryKey: ['threads'] })
      setPendingUser('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
      setDraft('')
      setPendingUser('')
      await client.invalidateQueries({ queryKey: ['messages', threadId] })
    } finally {
      setSending(false)
    }
  }

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('This browser does not support location.')
      return
    }
    setLocationLabel('Finding your location…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setLocationLabel('Location ready')
        toast.success('Location ready for your next search.')
      },
      (err) => {
        setLocation(null)
        setLocationLabel('Location off')
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. You can name a city in your message.'
            : 'Could not determine your location. Try again or name a city.'
        )
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    )
  }

  const starter = (prompt: string) => {
    void send(prompt)
  }

  return (
    <div className="workspace">
      <ThreadSidebar threadId={threadId} />
      <section className="chat-column">
        <header className="chat-header">
          <div className="header-context">
            <span className="header-kicker">VOLT / YOUR COPILOT</span>
            <h1>
              Find your next charge<span>.</span>
            </h1>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="trip-planner-btn"
              onClick={() => setShowTripModal(true)}
              title="Plan an EV highway trip between cities"
            >
              <Route size={14} /> Plan Trip
            </button>
            <button
              type="button"
              className={`voice-toggle-chip ${autoSpeak ? 'voice-toggle-on' : ''}`}
              onClick={() => {
                const next = !autoSpeak
                setAutoSpeak(next)
                toast.info(next ? 'Auto-voice read aloud enabled' : 'Auto-voice read aloud disabled')
              }}
              title="Automatically speak Volt responses"
            >
              {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>Voice: {autoSpeak ? 'ON' : 'OFF'}</span>
            </button>
            <Link to="/app/$threadId/compare" params={{ threadId }} className="header-link">
              <ArrowDownUp size={15} /> Compare{' '}
              <span className="header-link-count">
                {messages.reduce((n, m) => n + (m.parts ?? []).filter((p) => p.stations).flatMap((p) => p.stations ?? []).length, 0)}
              </span>
            </Link>
            <span className="user-avatar">V</span>
          </div>
        </header>

        <div className="conversation" key={threadId}>
          <div className="conversation-inner">
            {isLoading && (
              <div className="loading-state">
                <span className="loader" /> Restoring this conversation…
              </div>
            )}
            {error && (
              <div className="error-state">
                <CircleHelp size={18} />
                <span>Could not load messages.</span>
                <button onClick={() => void client.invalidateQueries({ queryKey: ['messages', threadId] })}>Retry</button>
                <button onClick={() => void api.createThread().then((t) => navigate({ to: '/app/$threadId', params: { threadId: t.id } }))}>Start new chat</button>
              </div>
            )}
            {!isLoading && !messages.length && !pendingUser && !draft && <Welcome onPrompt={starter} onOpenTrip={() => setShowTripModal(true)} />}
            {messages.map((message) => (
              <Message key={message.id} message={message} speakingId={speakingId} onToggleSpeak={toggleSpeak} />
            ))}
            {pendingUser && (
              <div className="message-row user-row">
                <div className="message-content">
                  <div className="message-author">
                    YOU <span>NOW</span>
                  </div>
                  <div className="message-text">{pendingUser}</div>
                </div>
              </div>
            )}
            {(draft || sending) && (
              <div className="message-row assistant-row">
                <div className="assistant-avatar">
                  <Bolt size={14} fill="currentColor" />
                </div>
                <div className="message-content">
                  <div className="message-author">
                    VOLT <span>NOW</span>
                  </div>
                  <div className="message-text">
                    {draft}
                    {sending && !draft && (
                      <span className="typing-dots">
                        Thinking<span>.</span><span>.</span><span>.</span>
                      </span>
                    )}
                    {sending && draft && <span className="stream-caret" />}
                  </div>
                  {draftTripPlan && <TripPlanCard plan={draftTripPlan} />}
                  {draftStations.map((station) => (
                    <StationCard station={station} key={station.id} />
                  ))}
                </div>
              </div>
            )}
            <div id="conversation-end" />
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              placeholder={listening ? 'Listening... speak now' : 'Ask about chargers, plan trips, or click mic to speak…'}
              rows={1}
              aria-label="Message Volt"
            />
            <div className="composer-tools">
              <button className={`location-chip ${location ? 'location-on' : ''}`} onClick={locate} title="Use your real device location">
                <LocateFixed size={14} />
                <span>{locationLabel}</span>
                <ChevronDown size={12} />
              </button>
              <span className="composer-hint">ENTER TO SEND</span>
              <button
                type="button"
                className={`mic-button ${listening ? 'mic-listening' : ''}`}
                onClick={toggleListening}
                title={listening ? 'Stop listening' : 'Speak to Volt'}
                aria-label={listening ? 'Stop listening' : 'Speak to Volt'}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button className="send-button" disabled={!text.trim() || sending} onClick={() => void send()} aria-label="Send message">
                <Send size={16} />
              </button>
            </div>
          </div>
          <p className="composer-disclaimer">
            <ShieldCheck size={12} /> Volt uses verified highway EV networks. Pricing & availability should be confirmed with the operator.
          </p>
        </div>
      </section>

      <TripPlannerModal
        isOpen={showTripModal}
        onClose={() => setShowTripModal(false)}
        onPlanSelected={(prompt) => void send(prompt)}
      />
    </div>
  )
}

function Welcome({ onPrompt, onOpenTrip }: { onPrompt: (prompt: string) => void; onOpenTrip?: () => void }) {
  const prompts = [
    'Plan trip from Chennai to Kodaikanal in Nexon EV with 250 km range',
    'Find fast CCS chargers near Mumbai within 25 km',
    'Plan trip from Bangalore to Ooty in MG ZS EV',
  ]
  return (
    <div className="welcome-state">
      <div className="welcome-orbit">
        <span />
        <Bolt size={22} fill="currentColor" />
      </div>
      <span className="eyebrow">THE ROAD IS YOURS</span>
      <h2>Where to next?</h2>
      <p>Tell me what you need. I will find real stations, plan your highway charging stops, and calculate battery depletion.</p>
      <div className="prompt-picks">
        {prompts.map((prompt, index) => (
          <button key={prompt} onClick={() => onPrompt(prompt)}>
            <span>0{index + 1}</span>
            {prompt}
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      <span className="location-reminder" style={{ cursor: 'pointer' }} onClick={onOpenTrip}>
        <Route size={13} /> Click here to open the Interactive Trip Planner
      </span>
    </div>
  )
}

function TripPlannerModal({
  isOpen,
  onClose,
  onPlanSelected,
}: {
  isOpen: boolean
  onClose: () => void
  onPlanSelected: (prompt: string) => void
}) {
  const [origin, setOrigin] = useState('Chennai')
  const [destination, setDestination] = useState('Kodaikanal')
  const [carName, setCarName] = useState('Tata Nexon EV')
  const [rangeKm, setRangeKm] = useState(260)
  const [initialSoc, setInitialSoc] = useState(95)

  if (!isOpen) return null

  const presets = [
    { name: 'Tata Nexon EV', range: 260 },
    { name: 'Tata Punch EV', range: 230 },
    { name: 'MG ZS EV', range: 340 },
    { name: 'Mahindra XUV400', range: 270 },
    { name: 'Tata Tiago EV', range: 170 },
    { name: 'Hyundai Ioniq 5', range: 460 },
    { name: 'BYD Atto 3', range: 380 },
    { name: 'Custom EV', range: rangeKm },
  ]

  const handleCarChange = (name: string) => {
    setCarName(name)
    const found = presets.find((p) => p.name === name)
    if (found && found.name !== 'Custom EV') {
      setRangeKm(found.range)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!origin.trim() || !destination.trim()) {
      toast.error('Please enter both origin and destination cities.')
      return
    }
    const prompt = `Plan a trip from ${origin.trim()} to ${destination.trim()} in my ${carName} with ${rangeKm} km range (starting at ${initialSoc}% battery)`
    onPlanSelected(prompt)
    onClose()
  }

  return (
    <div className="trip-modal-overlay" onClick={onClose}>
      <div className="trip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trip-modal-header">
          <div>
            <span className="eyebrow">AUTONOMOUS HIGHWAY COPILOT</span>
            <h2>Plan an EV Road Trip</h2>
          </div>
          <button type="button" className="trip-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <form className="trip-form" onSubmit={handleSubmit}>
          <div className="trip-form-row">
            <div className="trip-form-group">
              <label>Starting City (From)</label>
              <input
                type="text"
                className="trip-input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Chennai"
                required
              />
            </div>
            <div className="trip-form-group">
              <label>Destination City (To)</label>
              <input
                type="text"
                className="trip-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Kodaikanal"
                required
              />
            </div>
          </div>
          <div className="trip-form-row">
            <div className="trip-form-group">
              <label>Electric Vehicle Model</label>
              <select className="trip-select" value={carName} onChange={(e) => handleCarChange(e.target.value)}>
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="trip-form-group">
              <label>Real Range (km)</label>
              <input
                type="number"
                className="trip-input"
                value={rangeKm}
                onChange={(e) => setRangeKm(Number(e.target.value))}
                min={50}
                max={1000}
                required
              />
            </div>
          </div>
          <div className="trip-form-group">
            <label>Departure Battery SoC: {initialSoc}%</label>
            <input
              type="range"
              min={10}
              max={100}
              value={initialSoc}
              onChange={(e) => setInitialSoc(Number(e.target.value))}
              style={{ accentColor: '#c7f36b' }}
            />
          </div>
          <button type="submit" className="trip-submit-btn">
            <Route size={16} /> Plan Route & Charging Stops
          </button>
        </form>
      </div>
    </div>
  )
}

function TripPlanCard({ plan }: { plan: TripPlan }) {
  return (
    <div className="trip-plan-card">
      <div className="trip-plan-header">
        <div className="trip-plan-route">
          <MapPin size={16} />
          <span>{plan.origin}</span>
          <ArrowRight size={14} />
          <span>{plan.destination}</span>
        </div>
        <div className="trip-car-badge">
          <Car size={13} />
          <span>
            {plan.car_name} ({plan.car_range_km} km range)
          </span>
        </div>
      </div>

      <div className="trip-stats-grid">
        <div className="trip-stat-item">
          <span className="trip-stat-label">Total Distance</span>
          <span className="trip-stat-val">{plan.total_distance_km} km</span>
        </div>
        <div className="trip-stat-item">
          <span className="trip-stat-label">Charging Stops</span>
          <span className="trip-stat-val">
            {plan.stops_count} stop{plan.stops_count === 1 ? '' : 's'}
          </span>
        </div>
        <div className="trip-stat-item">
          <span className="trip-stat-label">Total Charge Time</span>
          <span className="trip-stat-val">{plan.total_charging_mins} mins</span>
        </div>
        <div className="trip-stat-item">
          <span className="trip-stat-label">Est. Charging Cost</span>
          <span className="trip-stat-val">₹{plan.total_charging_cost_inr.toFixed(0)}</span>
        </div>
      </div>

      <div className="trip-timeline">
        <div className="trip-timeline-item">
          <div className="trip-stop-dot dot-start">📍</div>
          <div className="trip-stop-body">
            <div className="trip-stop-top">
              <span className="trip-stop-title">Departure: {plan.origin}</span>
              <span className="trip-stop-dist">0 km</span>
            </div>
            <div className="trip-stop-battery-bar">
              <BatteryCharging size={14} /> Starting Battery: {plan.initial_soc_pct}%
            </div>
          </div>
        </div>

        {plan.stops.map((stop) => (
          <div className="trip-timeline-item" key={stop.stop_number}>
            <div className="trip-stop-dot dot-charging">⚡</div>
            <div className="trip-stop-body">
              <div className="trip-stop-top">
                <span className="trip-stop-title">
                  Stop {stop.stop_number}: {stop.station.name}
                </span>
                <span className="trip-stop-dist">{stop.distance_from_origin_km.toFixed(0)} km</span>
              </div>
              <div className="trip-stop-battery-bar">
                <BatteryCharging size={14} />
                <span>
                  Arrival: {stop.battery_at_arrival_pct}% ➔ Charge to {stop.charge_to_pct}% (~{stop.estimated_charge_mins} mins · ₹
                  {stop.estimated_cost_inr.toFixed(0)})
                </span>
              </div>
              <div className="trip-amenity">
                <span>☕ {stop.amenity} · {stop.station.max_power_kw} kW DC Fast Charger</span>
              </div>
            </div>
          </div>
        ))}

        <div className="trip-timeline-item">
          <div className="trip-stop-dot dot-end">🏁</div>
          <div className="trip-stop-body">
            <div className="trip-stop-top">
              <span className="trip-stop-title">Arrival: {plan.destination}</span>
              <span className="trip-stop-dist">{plan.total_distance_km} km</span>
            </div>
            <div className="trip-stop-battery-bar" style={{ color: plan.destination_arrival_soc_pct < 18 ? '#ffb347' : '#64c8ff' }}>
              <Check size={14} /> Remaining Battery: {plan.destination_arrival_soc_pct}% {plan.destination_arrival_soc_pct < 18 ? '(low reserve buffer)' : '(safe reserve)'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Message({
  message,
  speakingId,
  onToggleSpeak,
}: {
  message: ChatMessage
  speakingId?: string | null
  onToggleSpeak?: (id: string, text: string) => void
}) {
  const text = message.parts?.filter((part) => part.type === 'text').map((part) => part.text).join('') ?? ''
  const displayText =
    message.role === 'assistant' && isChargerToolCall(text)
      ? 'That charger search did not complete. Please ask again and include a city or share your location.'
      : text
  const stations = message.parts?.flatMap((part) => part.stations ?? []) ?? []
  const tripPlans = message.parts?.flatMap((part) => (part.trip_plan ? [part.trip_plan] : [])) ?? []
  const isSpeaking = speakingId === message.id
  return (
    <div className={`message-row ${message.role === 'user' ? 'user-row' : 'assistant-row'}`}>
      {message.role === 'assistant' && (
        <div className="assistant-avatar">
          <Bolt size={14} fill="currentColor" />
        </div>
      )}
      <div className="message-content">
        <div className="message-author">
          {message.role === 'assistant' ? 'VOLT' : 'YOU'}{' '}
          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {message.role === 'assistant' && displayText && onToggleSpeak && (
            <button
              type="button"
              className={`speak-button ${isSpeaking ? 'speak-speaking' : ''}`}
              onClick={() => onToggleSpeak(message.id, displayText)}
              title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
              aria-label={isSpeaking ? 'Stop speaking' : 'Read aloud'}
            >
              {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          )}
        </div>
        {displayText && <div className="message-text">{displayText}</div>}
        {tripPlans.map((plan, idx) => (
          <TripPlanCard plan={plan} key={idx} />
        ))}
        {stations.map((station) => (
          <StationCard station={station} key={station.id} />
        ))}
      </div>
    </div>
  )
}

function isChargerToolCall(text: string) {
  const trimmed = text.trim()
  if (/^\{\s*(?:"(?:name|tool)"\s*:\s*"(?:find_chargers|plan_ev_trip)"|"function"\s*:\s*\{\s*"name"\s*:\s*"(?:find_chargers|plan_ev_trip)")/.test(trimmed))
    return true
  try {
    const payload = JSON.parse(trimmed) as { name?: string; tool?: string; function?: { name?: string } }
    return (
      payload.name === 'find_chargers' ||
      payload.tool === 'find_chargers' ||
      payload.function?.name === 'find_chargers' ||
      payload.name === 'plan_ev_trip' ||
      payload.tool === 'plan_ev_trip' ||
      payload.function?.name === 'plan_ev_trip'
    )
  } catch {
    return false
  }
}

function StationCard({ station }: { station: Station }) {
  return (
    <article className="station-card">
      <div className="station-topline">
        <span className="station-data-tag">
          <span className="live-dot" /> {station.data_source || 'EV NETWORK'}
        </span>
        <span className="station-distance">
          <MapPin size={12} /> {station.distance_km.toFixed(1)} km
        </span>
      </div>
      <div className="station-main">
        <div>
          <h3>{station.name || 'Charging station'}</h3>
          <p>{station.address || 'Address not provided'}</p>
        </div>
        <div className="station-price">
          {station.price_per_kwh ? (
            <>
              <strong>
                {station.price_per_kwh.currency} {station.price_per_kwh.amount.toFixed(2)}
              </strong>
              <span>/ kWh</span>
            </>
          ) : (
            <>
              <strong>Price unknown</strong>
              <span>Check with operator</span>
            </>
          )}
        </div>
      </div>
      <div className="station-specs">
        <span>
          <PlugZap size={14} /> {station.connector_types.length ? station.connector_types.join(' · ') : 'Connector details unavailable'}
        </span>
        <span>
          <Gauge size={14} /> {station.max_power_kw ? `${station.max_power_kw} kW max` : 'Power not listed'}
        </span>
        {station.operator && (
          <span className="station-operator">
            {station.operator_website ? (
              <a href={station.operator_website} target="_blank" rel="noreferrer">
                {station.operator}
                <ArrowUpRight size={11} />
              </a>
            ) : (
              station.operator
            )}
          </span>
        )}
      </div>
    </article>
  )
}

export function ComparePage() {
  const { threadId } = useParams({ strict: false }) as { threadId: string }
  const { data: stations = [], isLoading, error } = useQuery({ queryKey: ['stations', threadId], queryFn: () => api.stations(threadId) })
  const [sort, setSort] = useState<'price' | 'distance' | 'power'>('price')
  usePageMetadata('Station comparison', 'Compare charging stations by price, distance, connector and power.')
  const sorted = [...stations].sort((a, b) => (sort === 'distance' ? a.distance_km - b.distance_km : sort === 'power' ? (b.max_power_kw ?? -1) - (a.max_power_kw ?? -1) : priceSort(a, b)))
  const currencies = new Set(sorted.flatMap((s) => (s.price_per_kwh ? [s.price_per_kwh.currency] : [])))
  const known = currencies.size === 1 ? sorted.filter((s) => s.price_per_kwh) : []
  const cheapest = known.length ? Math.min(...known.map((s) => s.price_per_kwh!.amount)) : null
  return (
    <div className="workspace">
      <ThreadSidebar threadId={threadId} />
      <section className="compare-column">
        <header className="compare-header">
          <Link to="/app/$threadId" params={{ threadId }} className="back-link">
            <ArrowLeft size={14} /> Conversation
          </Link>
          <span className="header-kicker">VOLT / SIDE BY SIDE</span>
          <h1>
            Make the
            <br />
            <em>smart stop.</em>
          </h1>
          <p>Every station surfaced in this conversation, compared with the details that matter.</p>
          <div className="sort-control">
            <span>SORT BY</span>
            {(['price', 'distance', 'power'] as const).map((value) => (
              <button className={sort === value ? 'sort-active' : ''} onClick={() => setSort(value)} key={value}>
                {value === 'price' ? 'Price' : value === 'distance' ? 'Distance' : 'Power'}
              </button>
            ))}
          </div>
        </header>
        <div className="compare-results">
          {isLoading ? (
            <div className="loading-state">
              <span className="loader" /> Gathering your stations…
            </div>
          ) : error ? (
            <div className="error-state">
              Could not load station results. <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : sorted.length ? (
            <>
              <StationMap stations={sorted} />
              {sorted.map((station) => (
                <article className="compare-row" key={station.id}>
                  <div className="compare-place">
                    <div className="compare-pin">
                      <MapPin size={15} />
                    </div>
                    <div>
                      <h3>{station.name}</h3>
                      <p>{station.operator ?? 'Operator not listed'}</p>
                    </div>
                    {station.price_per_kwh?.currency === [...currencies][0] && station.price_per_kwh?.amount === cheapest && (
                      <span className="cheapest-badge">
                        <Check size={12} /> LOWEST PRICE
                      </span>
                    )}
                  </div>
                  <div className="compare-facts">
                    <div>
                      <span>PRICE / KWH</span>
                      <strong>
                        {station.price_per_kwh ? `${station.price_per_kwh.currency} ${station.price_per_kwh.amount.toFixed(2)}` : 'Not listed'}
                      </strong>
                    </div>
                    <div>
                      <span>DISTANCE</span>
                      <strong>{station.distance_km.toFixed(1)} km</strong>
                    </div>
                    <div>
                      <span>MAX POWER</span>
                      <strong>{station.max_power_kw ? `${station.max_power_kw} kW` : 'Not listed'}</strong>
                    </div>
                    <div>
                      <span>CONNECTORS</span>
                      <strong>{station.connector_types.join(', ') || 'Not listed'}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </>
          ) : (
            <div className="compare-empty">
              <div className="empty-icon">
                <ArrowDownUp size={20} />
              </div>
              <span className="eyebrow">NOTHING TO COMPARE YET</span>
              <h2>No chargers found yet.</h2>
              <p>Ask Volt to search nearby stations. They’ll show up here for an easy side-by-side.</p>
              <Link to="/app/$threadId" params={{ threadId }} className="button button-primary">
                Back to chat <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StationMap({ stations }: { stations: Station[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const signature = stations.map((station) => `${station.id}:${station.latitude}:${station.longitude}`).join('|')
  useEffect(() => {
    if (!mapRef.current || !stations.length) return
    const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)
    const markers = stations.map((station) => {
      const marker = L.circleMarker([station.latitude, station.longitude], {
        radius: 7,
        color: '#d8ff8b',
        weight: 2,
        fillColor: '#29382b',
        fillOpacity: 1,
      }).addTo(map)
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = station.name
      const distance = document.createElement('p')
      distance.textContent = `${station.distance_km.toFixed(1)} km away`
      popup.append(title, distance)
      marker.bindPopup(popup)
      return marker
    })
    map.fitBounds(L.featureGroup(markers).getBounds().pad(0.18), { maxZoom: 13 })
    return () => {
      map.remove()
    }
  }, [signature])
  return (
    <div className="map-frame">
      <div ref={mapRef} className="station-map" aria-label="Map of charging stations" />
      <span className="map-credit">STATION LOCATIONS · © OPENSTREETMAP CONTRIBUTORS</span>
    </div>
  )
}

function priceSort(a: Station, b: Station) {
  const aPrice = a.price_per_kwh?.amount
  const bPrice = b.price_per_kwh?.amount
  if (aPrice == null && bPrice == null) return a.distance_km - b.distance_km
  if (aPrice == null) return 1
  if (bPrice == null) return -1
  if (a.price_per_kwh?.currency !== b.price_per_kwh?.currency) return a.distance_km - b.distance_km
  return aPrice - bPrice
}

export function SettingsPage() {
  usePageMetadata('Preferences', 'Manage your Volt account and local assistant settings.')
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: api.me })
  return (
    <div className="settings-screen">
      <Link to="/" className="brand">
        <span className="brand-mark">
          <Bolt size={15} fill="currentColor" />
        </span>
        volt<span className="brand-period">.</span>
      </Link>
      <div className="settings-inner">
        <Link to="/app" className="back-link">
          <ArrowLeft size={14} /> Back to your chats
        </Link>
        <span className="eyebrow">LOCAL PROFILE</span>
        <h1>
          Preferences<span>.</span>
        </h1>
        <div className="settings-section">
          <div className="settings-avatar">{profile?.display_name?.slice(0, 1) ?? 'V'}</div>
          <div>
            <h2>{profile?.display_name ?? 'Volt driver'}</h2>
            <p>Your conversations are stored in this app's local database.</p>
          </div>
        </div>
        <div className="settings-section settings-status">
          <div className="status-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <h2>Local AI assistant</h2>
            <p>Volt connects to your configured Ollama model. No paid AI API required.</p>
          </div>
          <span className="config-status">
            <span className="status-dot" /> CHECKING
          </span>
        </div>
        <div className="settings-section settings-status">
          <div className="status-icon">
            <MapPin size={16} />
          </div>
          <div>
            <h2>Location access</h2>
            <p>Your browser asks permission each time. Coordinates are used only to search nearby stations.</p>
          </div>
          <span className="privacy-label">
            <ShieldCheck size={13} /> PRIVATE
          </span>
        </div>
      </div>
    </div>
  )
}
