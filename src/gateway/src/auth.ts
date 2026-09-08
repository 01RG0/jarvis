import jwt from 'jsonwebtoken'
import { IncomingMessage } from 'http'

const SECRET = process.env.GATEWAY_SECRET_KEY || 'dev-secret'

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
