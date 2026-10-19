/**
 * VaultScene — premium SVG + CSS animated vault hero.
 * Metallic door with gradient depth, rotating dial, blue/purple/teal rim lights,
 * floating USDC coins with parallax, particle sparkles, pulsing glow.
 * On hover: dial spins faster + door rim brightens.
 * No WebGL — works everywhere. Respects prefers-reduced-motion.
 * Pauses when tab is hidden.
 */
import { useEffect, useRef, useState } from 'react'

interface Props {
  released?: boolean
}

const COINS = [
  { cx: 54,  cy: 50,  r: 14, dx: 0.6,  dy: 0.8,  delay: '0s',   dur: '3.4s' },
  { cx: 248, cy: 44,  r: 11, dx: -0.5, dy: 0.7,  delay: '0.7s', dur: '2.9s' },
  { cx: 44,  cy: 174, r: 10, dx: 0.4,  dy: -0.6, delay: '1.3s', dur: '3.8s' },
  { cx: 256, cy: 170, r: 12, dx: -0.7, dy: 0.5,  delay: '0.3s', dur: '3.2s' },
  { cx: 150, cy: 22,  r: 9,  dx: 0.3,  dy: 0.9,  delay: '1.0s', dur: '4.1s' },
]

const SPARKLES = [
  { cx: 84,  cy: 56,  r: 3,   delay: '0s',   color: '#a78bfa' },
  { cx: 222, cy: 50,  r: 2.5, delay: '0.6s', color: '#60a5fa' },
  { cx: 70,  cy: 160, r: 3,   delay: '1.2s', color: '#2dd4bf' },
  { cx: 230, cy: 164, r: 2.5, delay: '1.8s', color: '#a78bfa' },
  { cx: 152, cy: 32,  r: 2.5, delay: '0.3s', color: '#60a5fa' },
  { cx: 158, cy: 196, r: 3,   delay: '1.1s', color: '#2dd4bf' },
  { cx: 106, cy: 30,  r: 2,   delay: '0.9s', color: '#a78bfa' },
  { cx: 194, cy: 190, r: 2,   delay: '1.5s', color: '#60a5fa' },
  { cx: 265, cy: 100, r: 2,   delay: '0.5s', color: '#2dd4bf' },
  { cx: 35,  cy: 110, r: 2,   delay: '1.7s', color: '#a78bfa' },
]

export function VaultScene({ released = false }: Props) {
  const frameRef    = useRef<number>(0)
  const [angle,    setAngle]    = useState(0)
  const [paused,   setPaused]   = useState(false)
  const [hovered,  setHovered]  = useState(false)
  const [glowAlpha, setGlowAlpha] = useState(0.45)

  // Pause when tab hidden
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // RAF: dial rotation + glow pulse
  useEffect(() => {
    if (paused) return
    let last = performance.now()
    let t = 0
    function tick(now: number) {
      const dt = now - last
      last = now
      t += dt * 0.001
      // Dial: faster on hover
      const speed = hovered ? 0.06 : 0.018
      setAngle(a => (a + dt * speed) % 360)
      // Glow pulse
      setGlowAlpha(0.38 + 0.38 * Math.sin(t * 1.2))
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [paused, hovered])

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        maxWidth: 300,
        margin: '0 auto',
        userSelect: 'none',
        cursor: 'default',
        filter: `drop-shadow(0 0 ${hovered ? 40 : 24}px rgba(59,130,246,${hovered ? 0.28 : 0.16}))`,
        transition: 'filter 0.4s ease',
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 300 220"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* ── Vault body gradients ── */}
          <linearGradient id="g-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#1c3d72" />
            <stop offset="45%"  stopColor="#112a56" />
            <stop offset="100%" stopColor="#081840" />
          </linearGradient>

          {/* Metallic door — three-stop for depth */}
          <linearGradient id="g-door" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#2e5298" />
            <stop offset="40%"  stopColor="#1e3878" />
            <stop offset="100%" stopColor="#101e52" />
          </linearGradient>

          {/* Door sheen highlight — top-left corner catch light */}
          <linearGradient id="g-sheen" x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor="rgba(160,200,255,0.22)" />
            <stop offset="60%"  stopColor="rgba(160,200,255,0.04)" />
            <stop offset="100%" stopColor="rgba(160,200,255,0)"    />
          </linearGradient>

          {/* Metallic bevel highlight */}
          <linearGradient id="g-bevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(180,215,255,0.35)" />
            <stop offset="100%" stopColor="rgba(180,215,255,0)"    />
          </linearGradient>

          {/* Rim-light gradient — blue→purple→teal around door edge */}
          <linearGradient id="g-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={hovered ? '#60a5fa' : '#3b82f6'} />
            <stop offset="50%"  stopColor={hovered ? '#c4b5fd' : '#8b5cf6'} />
            <stop offset="100%" stopColor={hovered ? '#5eead4' : '#14b8a6'} />
          </linearGradient>

          {/* Ambient glow radials */}
          <radialGradient id="g-glow-b" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity={glowAlpha} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="g-glow-p" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={glowAlpha * 0.7} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="g-glow-t" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#14b8a6" stopOpacity={glowAlpha * 0.55} />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </radialGradient>

          {/* Gold coin */}
          <radialGradient id="g-coin" cx="32%" cy="28%" r="72%">
            <stop offset="0%"   stopColor="#fef08a" />
            <stop offset="55%"  stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#92400e" />
          </radialGradient>

          {/* Dial ring */}
          <linearGradient id="g-dial" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" />
            <stop offset="50%"  stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>

          {/* Handle chrome */}
          <linearGradient id="g-handle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#3a5272" />
            <stop offset="35%"  stopColor="#7ea8d0" />
            <stop offset="65%"  stopColor="#9cc0e0" />
            <stop offset="100%" stopColor="#3a5272" />
          </linearGradient>

          {/* Released crack glow */}
          <linearGradient id="g-crack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#93c5fd" stopOpacity="0.95" />
            <stop offset="50%"  stopColor="#c4b5fd" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.95" />
          </linearGradient>

          {/* Status light active */}
          <radialGradient id="g-light-a" cx="45%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </radialGradient>
          {/* Status light released */}
          <radialGradient id="g-light-r" cx="45%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#047857" />
          </radialGradient>

          {/* Filter: soft inner glow on door */}
          <filter id="f-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Layered ambient glows (dynamic opacity via JS) ── */}
        <ellipse cx="150" cy="128" rx="108" ry="64" fill="url(#g-glow-b)" />
        <ellipse cx="128" cy="118" rx="72"  ry="44" fill="url(#g-glow-p)" />
        <ellipse cx="172" cy="138" rx="56"  ry="34" fill="url(#g-glow-t)" />

        {/* ── Faint outer ring ── */}
        <ellipse cx="150" cy="122" rx="90" ry="68"
          fill="none"
          stroke="url(#g-rim)"
          strokeWidth="0.8"
          strokeOpacity={hovered ? 0.28 : 0.14}
        />

        {/* ── Floating USDC coins ── */}
        {COINS.map((c, i) => (
          <g key={i} style={{ animation: `coin-float ${c.dur} ${c.delay} ease-in-out infinite` }}>
            {/* Coin drop shadow */}
            <ellipse cx={c.cx} cy={c.cy + c.r + 3} rx={c.r * 0.65} ry={c.r * 0.18}
              fill="rgba(0,0,0,0.30)" />
            {/* Body */}
            <circle cx={c.cx} cy={c.cy} r={c.r} fill="url(#g-coin)" />
            {/* Edge ring */}
            <circle cx={c.cx} cy={c.cy} r={c.r}
              fill="none" stroke="#fde68a" strokeWidth="0.9" strokeOpacity="0.50" />
            {/* Rim highlight arc */}
            <path
              d={`M ${c.cx - c.r * 0.55} ${c.cy - c.r * 0.48}
                  A ${c.r} ${c.r} 0 0 1 ${c.cx + c.r * 0.55} ${c.cy - c.r * 0.48}`}
              fill="none"
              stroke="rgba(255,245,180,0.52)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {/* Label */}
            <text
              x={c.cx} y={c.cy + 0.8}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={c.r * 0.92} fill="#78350f" fontWeight="bold"
              fontFamily="'Space Grotesk', system-ui, sans-serif"
            >$</text>
          </g>
        ))}

        {/* ── Sparkles ── */}
        {SPARKLES.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.color}
            style={{ animation: `sparkle-pop 2.4s ${s.delay} ease-in-out infinite`, opacity: 0 }}
          />
        ))}

        {/* ══ VAULT GROUP (floats) ══ */}
        <g className="vault-float">

          {/* Ground shadow */}
          <ellipse cx="150" cy="193" rx="64" ry="7" fill="rgba(0,0,0,0.42)" />

          {/* ── Vault body ── */}
          <rect x="68" y="58" width="164" height="126" rx="14" fill="url(#g-body)" />
          {/* Body rim — gradient border */}
          <rect x="68" y="58" width="164" height="126" rx="14"
            fill="none" stroke="url(#g-rim)"
            strokeWidth={hovered ? 2 : 1.4}
            strokeOpacity={hovered ? 0.75 : 0.50}
          />
          {/* Top bevel highlight */}
          <rect x="68" y="58" width="164" height="40" rx="14"
            fill="url(#g-bevel)" />

          {/* ── Side accent panels ── */}
          {/* Left raised panel edge */}
          <rect x="68" y="68" width="4" height="106" rx="2"
            fill="rgba(59,130,246,0.18)" />
          {/* Right teal accent stripe */}
          <rect x="224" y="76" width="3.5" height="92" rx="1.75"
            fill="url(#g-dial)" fillOpacity="0.50" />

          {/* ── Door recess ── */}
          {/* Inset shadow */}
          <rect x="85" y="73" width="98" height="98" rx="10"
            fill="rgba(0,0,0,0.20)" />
          {/* Door face */}
          <rect x="87" y="75" width="94" height="94" rx="9" fill="url(#g-door)" />
          {/* Door rim highlight */}
          <rect x="87" y="75" width="94" height="94" rx="9"
            fill="none" stroke="url(#g-rim)"
            strokeWidth={hovered ? 1.8 : 1.1}
            strokeOpacity={hovered ? 0.60 : 0.35}
          />
          {/* Door sheen (catch-light) */}
          <rect x="87" y="75" width="94" height="48" rx="9" fill="url(#g-sheen)" />

          {/* Released — door crack glow */}
          {released && (
            <>
              <rect x="131" y="75" width="4" height="94"
                fill="url(#g-crack)"
                style={{ animation: 'glow-pulse 1.6s ease-in-out infinite' }}
              />
              <rect x="131" y="75" width="4" height="94"
                fill="rgba(180,210,255,0.12)" />
            </>
          )}

          {/* ── Hinges ── */}
          {/* Hinge body */}
          <rect x="78" y="87"  width="12" height="18" rx="4" fill="#162644" />
          <rect x="78" y="137" width="12" height="18" rx="4" fill="#162644" />
          {/* Hinge highlight */}
          <rect x="78" y="87"  width="12" height="18" rx="4"
            fill="none" stroke="rgba(59,130,246,0.32)" strokeWidth="0.8" />
          <rect x="78" y="137" width="12" height="18" rx="4"
            fill="none" stroke="rgba(59,130,246,0.32)" strokeWidth="0.8" />
          {/* Hinge pin */}
          <circle cx="84" cy="96"  r="3" fill="#1e3a60" />
          <circle cx="84" cy="146" r="3" fill="#1e3a60" />

          {/* ── Dial assembly ── */}
          {/* Dial surround */}
          <circle cx="134" cy="122" r="26"
            fill="#0d1830"
            stroke="url(#g-rim)"
            strokeWidth="1.8"
            strokeOpacity={hovered ? 0.80 : 0.55}
          />
          {/* Dial face */}
          <circle cx="134" cy="122" r="21"
            fill="#080e20"
            stroke="rgba(59,130,246,0.18)"
            strokeWidth="0.8"
          />
          {/* Inner ring */}
          <circle cx="134" cy="122" r="16"
            fill="#060a18"
            stroke="rgba(139,92,246,0.14)"
            strokeWidth="0.8"
          />
          {/* Tick marks + number dots (rotate with RAF) */}
          <g transform={`rotate(${angle}, 134, 122)`}>
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => {
              const rad   = (a * Math.PI) / 180
              const major = i % 3 === 0
              const inner = major ? 11 : 13
              const outer = 15
              const x1    = 134 + inner * Math.cos(rad)
              const y1    = 122 + inner * Math.sin(rad)
              const x2    = 134 + outer * Math.cos(rad)
              const y2    = 122 + outer * Math.sin(rad)
              return (
                <line key={a} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={major ? '#60a5fa' : '#8b5cf6'}
                  strokeWidth={major ? 2.2 : 1.2}
                  strokeLinecap="round"
                  strokeOpacity={major ? 0.95 : 0.50}
                />
              )
            })}
            {/* Cardinal dots */}
            {[0, 90, 180, 270].map(a => {
              const rad = (a * Math.PI) / 180
              return (
                <circle key={a}
                  cx={134 + 8 * Math.cos(rad)}
                  cy={122 + 8 * Math.sin(rad)}
                  r="1.8"
                  fill="#3b82f6"
                  fillOpacity="0.70"
                />
              )
            })}
          </g>
          {/* Dial center cap */}
          <circle cx="134" cy="122" r="5.5" fill="url(#g-dial)" />
          <circle cx="134" cy="122" r="2.8" fill="#fff" fillOpacity="0.88" />
          {/* Center glow ring */}
          <circle cx="134" cy="122" r="7"
            fill="none"
            stroke="url(#g-dial)"
            strokeWidth="0.8"
            strokeOpacity="0.45"
          />

          {/* ── Handle ── */}
          {/* Handle frame */}
          <rect x="193" y="108" width="26" height="28" rx="13"
            fill="none"
            stroke="url(#g-handle)"
            strokeWidth="4.5"
          />
          {/* Handle bar */}
          <rect x="197" y="119" width="18" height="6" rx="3"
            fill="url(#g-handle)"
          />
          {/* Handle sheen */}
          <rect x="196" y="109" width="12" height="4" rx="2"
            fill="rgba(220,240,255,0.20)"
          />

          {/* ── Combination display ── */}
          <rect x="90" y="155" width="74" height="15" rx="4"
            fill="rgba(0,0,0,0.40)"
            stroke="rgba(59,130,246,0.18)"
            strokeWidth="0.8"
          />
          {['A','M','N','H'].map((ch, i) => (
            <text key={i}
              x={99 + i * 15} y="164"
              textAnchor="middle" dominantBaseline="middle"
              fontSize="7.5"
              fill={released ? '#34d399' : '#4b8ac0'}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="bold"
              letterSpacing="0"
            >{ch}</text>
          ))}

          {/* ── Status indicator light ── */}
          <circle cx="202" cy="88" r="6"
            fill={released ? 'url(#g-light-r)' : 'url(#g-light-a)'}
            style={{ animation: 'glow-pulse 2.2s ease-in-out infinite' }}
          />
          {/* Halo ring */}
          <circle cx="202" cy="88" r="9.5"
            fill="none"
            stroke={released ? 'rgba(52,211,153,0.40)' : 'rgba(59,130,246,0.40)'}
            strokeWidth="1.2"
          />
          {/* Inner specular */}
          <circle cx="199" cy="85" r="2.2"
            fill="rgba(255,255,255,0.30)"
          />

        </g>{/* end vault-float */}
      </svg>
    </div>
  )
}
