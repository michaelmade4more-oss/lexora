export type RecoveryDeliveryStatus = 'submitted' | 'failed';
export type RecoveryFailureKind = 'transient' | 'permanent' | 'rate_limited' | 'timeout' | 'unknown';

export interface RecoveryMessage { recipient: string; resetUrl: string; correlationId: string; }
export interface RecoveryDeliveryResult { status: RecoveryDeliveryStatus; providerMessageId?: string; failureKind?: RecoveryFailureKind; errorCode?: string; }
export interface RecoveryDeliveryProvider { readonly name: string; send(message: RecoveryMessage): Promise<RecoveryDeliveryResult>; }

export async function deliverRecoveryWithRetry(provider: RecoveryDeliveryProvider, message: RecoveryMessage, maxAttempts = 3): Promise<RecoveryDeliveryResult> {
  let result: RecoveryDeliveryResult = { status: 'failed', failureKind: 'unknown', errorCode: 'delivery_not_attempted' };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result = await provider.send(message);
    if (result.status === 'submitted' || !['transient', 'rate_limited', 'timeout'].includes(result.failureKind || '')) return result;
    if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 25 * attempt));
  }
  return result;
}

export class CaptureRecoveryDeliveryProvider implements RecoveryDeliveryProvider {
  readonly name = 'capture';
  readonly messages: RecoveryMessage[] = [];
  async send(message: RecoveryMessage): Promise<RecoveryDeliveryResult> { this.messages.push(message); return { status: 'submitted', providerMessageId: `capture-${message.correlationId}` }; }
}

export class PostmarkRecoveryDeliveryProvider implements RecoveryDeliveryProvider {
  readonly name = 'postmark';
  constructor(private readonly config: { serverToken: string; from: string; templateAlias: string; endpoint?: string }) {}
  async send(message: RecoveryMessage): Promise<RecoveryDeliveryResult> {
    try {
      const response = await fetch(this.config.endpoint || 'https://api.postmarkapp.com/email/withTemplate', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': this.config.serverToken }, signal: AbortSignal.timeout(5_000), body: JSON.stringify({ From: this.config.from, To: message.recipient, TemplateAlias: this.config.templateAlias, TemplateModel: { reset_url: message.resetUrl }, MessageStream: 'outbound', Metadata: { correlation_id: message.correlationId } }) });
      const body = await response.json().catch(() => ({})) as { MessageID?: string; ErrorCode?: number };
      if (response.ok && body.MessageID) return { status: 'submitted', providerMessageId: body.MessageID };
      if (response.status === 408 || response.status === 429 || response.status >= 500) return { status: 'failed', failureKind: response.status === 429 ? 'rate_limited' : response.status === 408 ? 'timeout' : 'transient', errorCode: String(body.ErrorCode || response.status) };
      return { status: 'failed', failureKind: 'permanent', errorCode: String(body.ErrorCode || response.status) };
    } catch { return { status: 'failed', failureKind: 'timeout', errorCode: 'provider_unreachable' }; }
  }
}

export function createRecoveryDeliveryProvider(): RecoveryDeliveryProvider {
  if (process.env.NODE_ENV === 'test') return new CaptureRecoveryDeliveryProvider();
  if (process.env.RECOVERY_DELIVERY_ENABLED !== 'true') throw new Error('RECOVERY_DELIVERY_ENABLED must be true for production delivery');
  if (process.env.RECOVERY_DELIVERY_PROVIDER !== 'postmark') throw new Error('RECOVERY_DELIVERY_PROVIDER must be postmark');
  if (!process.env.POSTMARK_SERVER_TOKEN || !process.env.RECOVERY_FROM_EMAIL || !process.env.RECOVERY_TEMPLATE_ALIAS) throw new Error('Postmark recovery delivery configuration is incomplete');
  return new PostmarkRecoveryDeliveryProvider({ serverToken: process.env.POSTMARK_SERVER_TOKEN, from: process.env.RECOVERY_FROM_EMAIL, templateAlias: process.env.RECOVERY_TEMPLATE_ALIAS });
}
