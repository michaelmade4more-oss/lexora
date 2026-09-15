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

export type OAuthStateValidation = { nonce: string } | { failure: 'malformed' | 'signature' | 'payload' | 'expired' };
export function validateOAuthState(value: string): OAuthStateValidation {
  try {
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return { failure: 'malformed' };
    const expected = createHmac('sha256', Buffer.from(required('OAUTH_STATE_SECRET'))).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { failure: 'signature' };
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { nonce?: unknown; issuedAt?: unknown };
    if (typeof decoded.nonce !== 'string' || typeof decoded.issuedAt !== 'number') return { failure: 'payload' };
    if (Date.now() - decoded.issuedAt > 10 * 60 * 1000) return { failure: 'expired' };
    return { nonce: decoded.nonce };
  } catch { return { failure: 'payload' }; }
}

export function verifyOAuthState(value: string): { nonce: string } | null {
  const result = validateOAuthState(value);
  return 'nonce' in result ? result : null;
}

export async function createGoogleAuthorizationUrl(state: string, nonce: string): Promise<string> {
  const config = googleConfig();
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  return client.generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, nonce, prompt: 'select_account' });
}

export type GoogleOAuthDiagnostic = (stage: string, category?: string) => void;
function safeGoogleErrorCategory(error: unknown): string {
  const known = ['missing_id_token', 'invalid_google_identity', 'invalid_google_issuer', 'invalid_google_audience', 'expired_google_identity', 'invalid_google_nonce'];
  if (error instanceof Error && known.includes(error.message)) return error.message;
  return error instanceof Error ? error.name : typeof error;
}
export async function exchangeAndVerifyGoogleCode(code: string, expectedNonce: string, diagnostic?: GoogleOAuthDiagnostic): Promise<GoogleIdentity> {
  const config = googleConfig();
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  diagnostic?.('GOOGLE_TOKEN_EXCHANGE_STARTED');
  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
    diagnostic?.('GOOGLE_TOKEN_EXCHANGE_SUCCESS');
  } catch (error) {
    diagnostic?.('GOOGLE_TOKEN_EXCHANGE_FAILED', safeGoogleErrorCategory(error));
    throw error;
  }
  if (!tokens.id_token) {
    diagnostic?.('ID_TOKEN_PRESENT', 'missing');
    throw new Error('missing_id_token');
  }
  diagnostic?.('ID_TOKEN_PRESENT', 'present');
  diagnostic?.('ID_TOKEN_VALIDATION_STARTED');
  try {
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) throw new Error('invalid_google_identity');
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') throw new Error('invalid_google_issuer');
    if (payload.aud !== config.clientId) throw new Error('invalid_google_audience');
    if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error('expired_google_identity');
    if (payload.nonce !== expectedNonce) throw new Error('invalid_google_nonce');
    diagnostic?.('ID_TOKEN_VALIDATION_SUCCESS');
    diagnostic?.('GOOGLE_IDENTITY_VALIDATION', 'success');
    return { subject: payload.sub, email: payload.email.toLowerCase(), displayName: (payload.name || payload.email.split('@')[0]).trim().slice(0, 120) };
  } catch (error) {
    diagnostic?.('ID_TOKEN_VALIDATION_FAILED', safeGoogleErrorCategory(error));
    throw error;
  }
}

export function randomOAuthNonce(): string { return randomBytes(32).toString('base64url'); }
