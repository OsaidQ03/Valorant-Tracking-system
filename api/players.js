// Same-origin relay to the shared roster store, so the browser never hits CORS.
const STORE = 'https://jsonblob.com/api/jsonBlob/019ec76c-e335-7899-9e3e-b708ad4ca9fd'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const r = await fetch(STORE, { headers: { Accept: 'application/json' } })
    if (!r.ok) return res.status(502).json({ error: 'store unavailable' })
    return res.status(200).json(await r.json())
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'expected an array' })
    const r = await fetch(STORE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    if (!r.ok) return res.status(502).json({ error: 'store unavailable' })
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, POST')
  return res.status(405).json({ error: 'method not allowed' })
}
