import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, RotateCcw, Zap } from 'lucide-react'

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

const SUGGESTIONS = [
  'Why did Video A get more engagement than Video B?',
  "What's the engagement rate of each video?",
  'Compare the hooks in the first 5 seconds',
  "Who's the creator of Video B and what's their follower count?",
  'Suggest improvements for B based on what worked in A',
]

function SourceBadge({ source }) {
  const isA = source.includes('Video A')
  const color = isA ? '#818cf8' : '#34d399'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontFamily: "'DM Mono', monospace",
      background: `${color}15`, color: `${color}dd`,
      border: `1px solid ${color}30`,
      padding: '2px 8px', borderRadius: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {source}
    </span>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16, animation: 'fade-in 0.25s ease forwards',
    }}>
      <div style={{
        fontSize: 10, fontFamily: "'DM Mono', monospace",
        color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em',
        paddingLeft: isUser ? 0 : 2, paddingRight: isUser ? 2 : 0,
      }}>
        {isUser ? 'You' : 'CreatorRAG'}
        {msg.streaming && (
          <span style={{ marginLeft: 6, display: 'inline-flex', gap: 2 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 3, height: 3, borderRadius: '50%', background: '#6366f1',
                animation: `blink 1s ${i * 0.2}s infinite`
              }} />
            ))}
          </span>
        )}
      </div>

      <div style={{
        maxWidth: '88%',
        background: isUser ? 'linear-gradient(135deg, #1e1b4b, #312e81)' : '#0d1117',
        border: `1px solid ${isUser ? '#4338ca40' : '#1e293b'}`,
        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        padding: '11px 14px',
        fontSize: 13, lineHeight: 1.75, color: '#cbd5e1',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {msg.content || (msg.streaming ? '' : '…')}
        {msg.streaming && msg.content === '' && (
          <span style={{ display: 'inline-block', width: 8, height: 13, background: '#6366f1', animation: 'blink 0.8s infinite', borderRadius: 1 }} />
        )}
      </div>

      {msg.sources?.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: '88%' }}>
          {msg.sources.map((s, i) => <SourceBadge key={i} source={s} />)}
        </div>
      )}
    </div>
  )
}

export default function ChatPanel({ sessionId }) {
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    const question = (text || input).trim()
    if (!question || streaming) return
    setInput('')

    setMessages(prev => [
      ...prev,
      { role: 'user',      content: question },
      { role: 'assistant', content: '', sources: [], streaming: true },
    ])
    setStreaming(true)

    try {
      const res = await fetch(`${API}/api/chat/stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId, question }),
      })

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let streamBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        streamBuffer += decoder.decode(value, { stream: true })
        const lines = streamBuffer.split('\n')
        streamBuffer = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          try {
            const payload = JSON.parse(trimmed.slice(6))

            if (payload.type === 'sources') {
              setMessages(prev => {
                const next = [...prev]
                const last = { ...next[next.length - 1] }
                last.sources = payload.sources
                next[next.length - 1] = last
                return next
              })
            } else if (payload.type === 'token') {
              setMessages(prev => {
                const next = [...prev]
                const last = { ...next[next.length - 1] }
                last.content += payload.content
                next[next.length - 1] = last
                return next
              })
            } else if (payload.type === 'done') {
              setMessages(prev => {
                const next = [...prev]
                const last = { ...next[next.length - 1] }
                last.streaming = false
                next[next.length - 1] = last
                return next
              })
            }
          } catch { /* wait for next chunk if partial */ }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        const last = { ...next[next.length - 1] }
        last.content  = `Error: ${err.message}`
        last.streaming = false
        next[next.length - 1] = last
        return next
      })
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, sessionId, streaming])

  const clearChat = async () => {
    setMessages([])
    await fetch(`${API}/api/chat/${sessionId}`, { method: 'DELETE' }).catch(() => {})
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080a0f' }}>
      {/* Chat header */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #1e293b',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#0a0d14',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
            boxShadow: '0 0 6px #4ade80', animation: 'pulse-glow 2s infinite',
          }} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#64748b', letterSpacing: '0.06em' }}>
            RAG CHAT · Llama 3.3
          </span>
        </div>
        <button onClick={clearChat} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: '1px solid #1e293b',
          borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
          color: '#475569', fontSize: 11, fontFamily: "'DM Mono', monospace",
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#475569' }}
        >
          <RotateCcw size={11} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
        {messages.length === 0 && (
          <div style={{ animation: 'fade-in 0.4s ease forwards' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            }}>
              <Zap size={14} color="#6366f1" />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Suggested questions
              </span>
            </div>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', marginBottom: 7,
                background: '#0d1117', border: '1px solid #1e293b',
                borderRadius: 10, color: '#64748b',
                fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer', lineHeight: 1.5,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#a5b4fc' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#64748b' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', background: '#0a0d14' }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: '#0d1117', border: '1px solid #1e293b',
          borderRadius: 12, padding: '10px 14px',
          transition: 'border-color 0.2s',
          focusWithin: { borderColor: '#6366f1' },
        }}
          onFocus={() => {}}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about the videos..."
            disabled={streaming}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              resize: 'none', lineHeight: 1.5, maxHeight: 80, overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={streaming || !input.trim()}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: streaming || !input.trim() ? '#1e293b' : '#6366f1',
              cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.2s',
              boxShadow: streaming || !input.trim() ? 'none' : '0 0 12px rgba(99,102,241,0.4)',
            }}
          >
            {streaming
              ? <div style={{ width: 14, height: 14, border: '2px solid #475569', borderTopColor: '#94a3b8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Send size={14} color={streaming || !input.trim() ? '#475569' : '#fff'} />
            }
          </button>
        </div>
        <div style={{ marginTop: 6, textAlign: 'center', fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#1e293b' }}>
          Enter to send · Shift+Enter for newline
        </div>
      </div>
    </div>
  )
}
