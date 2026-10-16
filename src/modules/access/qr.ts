// Token de carnet rotatorio: person_id.ventana.firma HMAC-SHA256 (ventana de 60 s, tolera ±1).
// Usa Web Crypto, disponible en Node y en el navegador del servidor.
const WINDOW_S = 60

const enc = new TextEncoder()
const b64u = (buf: ArrayBuffer) => Buffer.from(buf).toString('base64url')

async function sign(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data))).slice(0, 16)
}

export async function makeCardToken(secret: string, personId: string, now = Date.now()): Promise<string> {
  const w = Math.floor(now / 1000 / WINDOW_S)
  return `${personId}.${w}.${await sign(secret, `${personId}.${w}`)}`
}

export async function verifyCardToken(secret: string, token: string, now = Date.now()): Promise<string | null> {
  const [id, w, sig] = token.split('.')
  if (!id || !w || !sig) return null
  const cur = Math.floor(now / 1000 / WINDOW_S)
  const win = Number(w)
  if (!Number.isFinite(win) || Math.abs(cur - win) > 1) return null
  const expect = await sign(secret, `${id}.${w}`)
  return expect === sig ? id : null
}
