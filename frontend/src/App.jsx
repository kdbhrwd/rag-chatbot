import React, { useState, useRef, useEffect } from 'react'
import { Youtube, Instagram, Zap, AlertCircle, ChevronRight, BarChart3, Database } from 'lucide-react'
import VideoCard from './components/VideoCard'
import ChatPanel from './components/ChatPanel'

const getCleanApiUrl = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  url = url.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api\/health$/, '').replace(/\/api$/, '');
  return url;
};
const API = getCleanApiUrl();

// ─── tiny hook to get a stable session id ────────────────────────────────────
function useSession() {
  const sid = useRef(null)
  if (!sid.current) sid.current = crypto.randomUUID()
  return sid.current
}

// ─── URL input component ──────────────────────────────────────────────────────
function UrlInput({ icon: Icon, placeholder, value, onChange, accentColor, disabled }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#0d1117',
      border: `1px solid ${focused ? accentColor + '60' : '#1e293b'}`,
      borderRadius: 11, padding: '10px 14px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: focused ? `0 0 0 3px ${accentColor}15` : 'none',
    }}>
      <Icon size={15} color={focused ? accentColor : '#475569'} style={{ flexShrink: 0, transition: 'color 0.2s' }} />
      <input
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: '#e2e8f0', fontSize: 13, fontFamily: "'DM Mono', monospace",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  )
}

// ─── Loading overlay ──────────────────────────────────────────────────────────
function LoadingOverlay({ step }) {
  const steps = [
    { label: 'Scraping YouTube metadata + transcript', done: step > 0 },
    { label: 'Scraping Instagram Reel + transcribing audio (Whisper)', done: step > 1 },
    { label: 'Chunking transcripts (300 tok, 50 overlap)', done: step > 2 },
    { label: 'Embedding + storing in ChromaDB', done: step > 3 },
  ]

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(8,10,15,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 380, width: '100%', padding: '0 24px' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#6366f115', border: '1px solid #6366f130',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Database size={22} color="#818cf8" />
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, color: '#e2e8f0', marginBottom: 6 }}>
            Building RAG Pipeline
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#475569' }}>
            This takes ~30–90 seconds
          </div>
        </div>

        {steps.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 14, opacity: s.done ? 1 : step === i ? 1 : 0.4,
            transition: 'opacity 0.3s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...(s.done
                ? { background: '#4ade8020', border: '1px solid #4ade8050' }
                : step === i
                ? { border: '2px solid #6366f1', animation: 'spin 0.8s linear infinite' }
                : { background: '#1e293b', border: '1px solid #334155' }
              )
            }}>
              {s.done
                ? <span style={{ fontSize: 11, color: '#4ade80' }}>✓</span>
                : step === i ? null
                : <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', display: 'block' }} />
              }
            </div>
            <span style={{
              fontSize: 12, fontFamily: "'DM Mono', monospace",
              color: s.done ? '#4ade80' : step === i ? '#a5b4fc' : '#475569',
            }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Hero / intro state ───────────────────────────────────────────────────────
function HeroPane({ ytUrl, setYtUrl, igUrl, setIgUrl, onAnalyze, loading, error }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: '#080a0f', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }} />
      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 460, width: '100%', zIndex: 1, animation: 'fade-in 0.5s ease forwards' }}>
        {/* Wordmark */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}>
              <BarChart3 size={18} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: '#e2e8f0', letterSpacing: '-0.02em' }}>
              CreatorRAG
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#475569', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>
            Intelligent video analytics · Powered by Llama 3.3 + ChromaDB
          </p>
        </div>

        {/* Input card */}
        <div style={{
          background: '#0d1117', borderRadius: 16,
          border: '1px solid #1e293b', padding: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Video A — YouTube
            </label>
            <UrlInput
              icon={Youtube}
              placeholder="https://youtube.com/watch?v=..."
              value={ytUrl}
              onChange={e => setYtUrl(e.target.value)}
              accentColor="#818cf8"
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Video B — Instagram Reel
            </label>
            <UrlInput
              icon={Instagram}
              placeholder="https://instagram.com/reel/..."
              value={igUrl}
              onChange={e => setIgUrl(e.target.value)}
              accentColor="#34d399"
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 12px', background: '#ff000010', border: '1px solid #f8717130',
              borderRadius: 8, fontSize: 12, color: '#fca5a5', fontFamily: "'DM Mono', monospace",
              lineHeight: 1.5,
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          <button
            onClick={onAnalyze}
            disabled={loading || !ytUrl.trim() || !igUrl.trim()}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: loading || !ytUrl.trim() || !igUrl.trim()
                ? '#1e293b'
                : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: loading || !ytUrl.trim() || !igUrl.trim() ? '#475569' : '#fff',
              fontSize: 13, fontWeight: 600, fontFamily: "'Syne', sans-serif",
              cursor: loading || !ytUrl.trim() || !igUrl.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
              boxShadow: loading || !ytUrl.trim() || !igUrl.trim() ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
            }}
          >
            <Zap size={14} />
            Analyze Videos
            <ChevronRight size={14} />
          </button>
        </div>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#334155' }}>
          LangChain · LangGraph · ChromaDB · all-MiniLM-L6-v2
        </p>
      </div>
    </div>
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [ytUrl,    setYtUrl]    = useState('')
  const [igUrl,    setIgUrl]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [metadata, setMetadata] = useState(null)
  const [error,    setError]    = useState('')
  const sessionId = useSession()

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')
    setLoadStep(0)

    // Simulate step progression (real steps happen server-side)
    const stepTimer = setInterval(() => {
      setLoadStep(prev => Math.min(prev + 1, 3))
    }, 8000)

    try {
      const res = await fetch(`${API}/api/ingest`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ youtube_url: ytUrl, instagram_url: igUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Ingestion failed')
      setMetadata({ A: data.video_a.metadata, B: data.video_b.metadata })
      setLoadStep(4)
    } catch (e) {
      setError(e.message)
    } finally {
      clearInterval(stepTimer)
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#080a0f', position: 'relative', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid #1e293b',
        background: '#0a0d14', flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BarChart3 size={13} color="#fff" />
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>
            CreatorRAG
          </span>
        </div>
        {metadata && (
          <button
            onClick={() => { setMetadata(null); setYtUrl(''); setIgUrl('') }}
            style={{
              background: 'transparent', border: '1px solid #1e293b', borderRadius: 7,
              padding: '5px 12px', color: '#475569', fontSize: 11,
              fontFamily: "'DM Mono', monospace", cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#475569' }}
          >
            ← New analysis
          </button>
        )}
      </div>

      {/* Body */}
      {!metadata ? (
        <>
          <HeroPane
            ytUrl={ytUrl} setYtUrl={setYtUrl}
            igUrl={igUrl} setIgUrl={setIgUrl}
            onAnalyze={handleAnalyze}
            loading={loading} error={error}
          />
          {loading && <LoadingOverlay step={loadStep} />}
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left panel: video cards */}
          <div style={{
            width: 330, flexShrink: 0, padding: '16px 12px',
            borderRight: '1px solid #1e293b', overflowY: 'auto',
            background: '#080a0f',
          }}>
            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, paddingLeft: 4 }}>
              Analyzed videos
            </div>
            <VideoCard label="A" data={metadata.A} highlight={metadata.A.engagement_rate > metadata.B.engagement_rate} />
            <div style={{ height: 10 }} />
            <VideoCard label="B" data={metadata.B} highlight={metadata.B.engagement_rate > metadata.A.engagement_rate} />

            {/* Comparison badge */}
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: '#0d1117', border: '1px solid #1e293b', borderRadius: 10,
              animation: 'fade-in 0.4s ease forwards',
            }}>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Engagement delta
              </div>
              {(() => {
                const diff = Math.abs(metadata.A.engagement_rate - metadata.B.engagement_rate).toFixed(2)
                const winner = metadata.A.engagement_rate >= metadata.B.engagement_rate ? 'A' : 'B'
                const color  = winner === 'A' ? '#818cf8' : '#34d399'
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 18, color }}>+{diff}%</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Video {winner} leads</span>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Right panel: chat */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatPanel sessionId={sessionId} />
          </div>
        </div>
      )}
    </div>
  )
}
