import { OAuth2Client } from 'google-auth-library';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type GoogleIdentity = { subject: string; email: string; displayName: string };

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

export function googleConfig() {
  return {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    redirectUri: required('GOOGLE_REDIRECT_URI'),
    stateSecret: required('OAUTH_STATE_SECRET')
  };
}

export function createOAuthState(nonce: string): string {
  const secret = Buffer.from(required('OAUTH_STATE_SECRET'));
  const payload = Buffer.from(JSON.stringify({ nonce, issuedAt: Date.now() })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyOAuthState(value: string): { nonce: string } | null {
  try {
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', Buffer.from(required('OAUTH_STATE_SECRET'))).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { nonce?: unknown; issuedAt?: unknown };
    if (typeof decoded.nonce !== 'string' || typeof decoded.issuedAt !== 'number' || Date.now() - decoded.issuedAt > 10 * 60 * 1000) return null;
    return { nonce: decoded.nonce };
  } catch { return null; }
}

export async function createGoogleAuthorizationUrl(state: string, nonce: string): Promise<string> {
  const config = googleConfig();
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  return client.generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, nonce, prompt: 'select_account' });
}

export async function exchangeAndVerifyGoogleCode(code: string, expectedNonce: string): Promise<GoogleIdentity> {
  const config = googleConfig();
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error('missing_id_token');
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) throw new Error('invalid_google_identity');
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') throw new Error('invalid_google_issuer');
  if (payload.aud !== config.clientId) throw new Error('invalid_google_audience');
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error('expired_google_identity');
  if (payload.nonce !== expectedNonce) throw new Error('invalid_google_nonce');
  return { subject: payload.sub, email: payload.email.toLowerCase(), displayName: (payload.name || payload.email.split('@')[0]).trim().slice(0, 120) };
}

export function randomOAuthNonce(): string { return randomBytes(32).toString('base64url'); }
