import { neon } from '@neondatabase/serverless'

const COLORS = ['green', 'red', 'yellow']
const MAX_PLAYERS = 200
const MAX_BYTES = 100_000

let sql = null
let ready = null

// The whole roster is one JSON row: the page always saves the full list (last write wins).
function db() {
  sql ??= neon(process.env.DATABASE_URL)
  ready ??= sql`CREATE TABLE IF NOT EXISTS roster (
    id int PRIMARY KEY CHECK (id = 1),
    players jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`.catch((e) => {
    ready = null
    throw e
  })
  return ready.then(() => sql)
}

const isPlayer = (p) =>
  p !== null &&
  typeof p === 'object' &&
  typeof p.id === 'number' &&
  typeof p.name === 'string' &&
  p.name.length <= 40 &&
  COLORS.includes(p.color) &&
  (p.desc === undefined || (typeof p.desc === 'string' && p.desc.length <= 200))

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'GET') {
      const q = await db()
      const rows = await q`SELECT players FROM roster WHERE id = 1`
      return res.status(200).json(rows[0]?.players ?? [])
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const players = req.body
      if (!Array.isArray(players) || players.length > MAX_PLAYERS || !players.every(isPlayer)) {
        return res.status(400).json({ error: 'expected an array of players' })
      }
      const json = JSON.stringify(players)
      if (json.length > MAX_BYTES) return res.status(413).json({ error: 'roster too large' })

      const q = await db()
      await q`INSERT INTO roster (id, players) VALUES (1, ${json}::jsonb)
              ON CONFLICT (id) DO UPDATE SET players = EXCLUDED.players, updated_at = now()`
      return res.status(200).json({ ok: true })
    }
  } catch (e) {
    console.error('roster store error', e)
    return res.status(502).json({ error: 'store unavailable' })
  }

  res.setHeader('Allow', 'GET, PUT, POST')
  return res.status(405).json({ error: 'method not allowed' })
}
