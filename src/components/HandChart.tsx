import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const PLAYER_LINE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#f97316', '#14b8a6',
]

type Player = {
  id: string
  name: string
}

type HandCategoryDetail = {
  cards: boolean
  coins: boolean
  settebello: boolean
  premiera: boolean
  scopa: number
}

type HandHistoryEntry = {
  handNumber: number
  scores: Record<string, number>
  categories: Record<string, HandCategoryDetail>
  timestamp: number
}

type HandChartProps = {
  players: Player[]
  handHistory: HandHistoryEntry[]
  tr: (key: string, params?: Record<string, string>) => string
}

function CustomTooltip({ active, payload, label, players, tr }: any) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-md text-sm">
      <div className="font-bold mb-2">{tr('game.hand')} {label}</div>
      {payload.map((entry: any) => {
        const player = players.find((p: Player) => p.id === entry.dataKey)
        if (!player) return null

        const handEntry = entry.payload._raw as HandHistoryEntry | undefined
        const catDetail = handEntry?.categories?.[player.id]
        const handScore = handEntry?.scores?.[player.id] || 0

        return (
          <div key={entry.dataKey} className="mb-1.5">
            <div style={{ color: entry.color }} className="font-semibold">
              {player.name}: {entry.value} {tr('game.total')}
            </div>
            {handEntry && (
              <div className="text-muted-foreground text-xs ml-2">
                +{handScore} this hand
                {catDetail && (
                  <span className="ml-1">
                    ({[
                      catDetail.cards && tr('category.cards'),
                      catDetail.coins && tr('category.coins'),
                      catDetail.settebello && tr('category.settebello'),
                      catDetail.premiera && tr('category.primiera'),
                      catDetail.scopa > 0 && `${tr('category.scopa')} ×${catDetail.scopa}`,
                    ].filter(Boolean).join(', ') || '—'})
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function HandChart({ players, handHistory, tr }: HandChartProps) {
  if (handHistory.length === 0) return null

  const chartData = handHistory.map((entry, idx) => {
    const point: Record<string, any> = { hand: entry.handNumber, _raw: entry }
    players.forEach(p => {
      point[p.id] = handHistory
        .slice(0, idx + 1)
        .reduce((sum, h) => sum + (h.scores[p.id] || 0), 0)
    })
    return point
  })

  return (
    <div className="w-full h-52 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis
            dataKey="hand"
            tick={{ fontSize: 12 }}
            label={{ value: tr('game.hand'), position: 'insideBottom', offset: -2, fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 12 }} width={30} />
          <Tooltip content={<CustomTooltip players={players} tr={tr} />} />
          {players.map((p, idx) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={p.id}
              name={p.name}
              stroke={PLAYER_LINE_COLORS[idx % PLAYER_LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
