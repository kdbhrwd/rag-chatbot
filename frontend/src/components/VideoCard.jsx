import React from 'react'
import { Eye, Heart, MessageCircle, Users, Clock, Calendar, TrendingUp, ExternalLink } from 'lucide-react'

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtDuration(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function fmtDate(d) {
  if (!d) return '—'
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function EngagementBar({ rate }) {
  const pct = Math.min(rate, 20) / 20 * 100
  const color = rate > 5 ? '#4ade80' : rate > 2 ? '#facc15' : '#f87171'
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Engagement Rate</span>
        <span style={{ fontSize: 15, fontFamily: "'DM Mono', monospace", fontWeight: 500, color }}>{rate?.toFixed(2)}%</span>
      </div>
      <div style={{ height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 2, transition: 'width 1s ease',
          boxShadow: `0 0 8px ${color}80`
        }} />
      </div>
    </div>
  )
}

function StatChip({ icon: Icon, label, value, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', background: '#0d1117',
      borderRadius: 8, border: '1px solid #1e293b',
    }}>
      <Icon size={13} color={accent || '#475569'} />
      <div>
        <div style={{ fontSize: 10, color: '#475569', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1', marginTop: 1 }}>{value}</div>
      </div>
    </div>
  )
}

export default function VideoCard({ label, data, highlight }) {
  const accentColor = label === 'A' ? '#818cf8' : '#34d399'
  const bgGlow = label === 'A' ? 'rgba(129,140,248,0.04)' : 'rgba(52,211,153,0.04)'

  return (
    <div style={{
      background: `linear-gradient(135deg, #0d1117 0%, ${bgGlow} 100%)`,
      border: `1px solid ${highlight ? accentColor + '60' : '#1e293b'}`,
      borderRadius: 14,
      padding: 16,
      transition: 'border-color 0.3s ease',
      animation: 'fade-in 0.4s ease forwards',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, color: accentColor
          }}>
            {label}
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#475569', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Video {label} · {data.platform}
            </div>
          </div>
        </div>
        <a href={data.url} target="_blank" rel="noreferrer"
          style={{ color: '#475569', transition: 'color 0.2s' }}
          onMouseEnter={e => e.target.style.color = accentColor}
          onMouseLeave={e => e.target.style.color = '#475569'}>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Title + creator */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', lineHeight: 1.4, marginBottom: 4 }}>
          {data.title?.slice(0, 72)}{(data.title?.length > 72) ? '…' : ''}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>
          @{data.creator}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <StatChip icon={Eye}            label="Views"     value={fmt(data.views)}               accent="#60a5fa" />
        <StatChip icon={Heart}          label="Likes"     value={fmt(data.likes)}               accent="#f472b6" />
        <StatChip icon={MessageCircle}  label="Comments"  value={fmt(data.comments)}            accent="#a78bfa" />
        <StatChip icon={Users}          label="Followers" value={fmt(data.follower_count)}      accent="#34d399" />
        <StatChip icon={Clock}          label="Duration"  value={fmtDuration(data.duration)}    accent="#fb923c" />
        <StatChip icon={Calendar}       label="Uploaded"  value={fmtDate(data.upload_date)}    accent="#94a3b8" />
      </div>

      {/* Engagement bar */}
      <EngagementBar rate={data.engagement_rate || 0} />

      {/* Hashtags */}
      {data.hashtags?.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {data.hashtags.slice(0, 6).map((h, i) => (
            <span key={i} style={{
              fontSize: 10, fontFamily: "'DM Mono', monospace",
              background: `${accentColor}12`, color: `${accentColor}cc`,
              border: `1px solid ${accentColor}25`,
              padding: '2px 7px', borderRadius: 4,
            }}>
              #{h.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
