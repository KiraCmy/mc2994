const CHANNELS = [
  { key: 'temperature', color: '#b45a2a', label: 'T' },
  { key: 'moisture', color: '#2a6f8f', label: 'M' },
  { key: 'disturbance', color: '#5a5a2a', label: 'D' },
]

const W = 220
const H = 72
const PAD = 4

function toPolyline(samples) {
  if (!samples.length) return ''
  const n = samples.length
  return samples
    .map((value, index) => {
      const x =
        n === 1 ? PAD : PAD + (index / (n - 1)) * (W - PAD * 2)
      const y = PAD + (1 - Math.min(1, Math.max(0, value))) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/**
 * Compact multi-channel sparkline of recent environmental values (0–1).
 */
export default function EnvHistoryGraph({ graph }) {
  const midY = PAD + 0.5 * (H - PAD * 2)

  return (
    <div className="playground-experiment__env-graph" aria-label="Environmental history">
      <p className="playground-experiment__controls-label">History</p>
      <svg
        className="playground-experiment__env-graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Temperature, moisture, and disturbance over recent time"
      >
        <line
          x1={PAD}
          x2={W - PAD}
          y1={midY}
          y2={midY}
          className="playground-experiment__env-graph-baseline"
        />
        {CHANNELS.map(({ key, color }) => {
          const points = toPolyline(graph[key] ?? [])
          if (!points) return null
          return (
            <polyline
              key={key}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="1.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      <ul className="playground-experiment__env-graph-legend">
        {CHANNELS.map(({ key, color, label }) => (
          <li key={key}>
            <span style={{ background: color }} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
