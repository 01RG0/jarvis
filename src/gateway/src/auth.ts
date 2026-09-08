import jwt from 'jsonwebtoken'
import { IncomingMessage } from 'http'

const _rawSecret = process.env.GATEWAY_SECRET_KEY
if (!_rawSecret) {
  throw new Error('GATEWAY_SECRET_KEY env var is required — generate with: openssl rand -hex 32')
}
const SECRET: string = _rawSecret

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, SECRET)
    return true
  } catch {
    return false
  }
}

export function extractToken(req: IncomingMessage): string | null {
  const auth = req.headers['authorization']
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const url = new URL(req.url || '', 'http://localhost')
  return url.searchParams.get('token')
}
