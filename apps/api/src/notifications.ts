import { newId } from './crypto.js';
import type { Store } from './store.js';
import type { Account, InboxMessage } from './types.js';

export interface PushSender {
  send(tokens: string[], message: { title: string; body: string; data?: Record<string, string> }): Promise<void>;
}

/**
 * Default sender posts to the Expo push service, which fans out to APNs / FCM.
 * Disabled unless EXPO_PUSH_ENABLED=true so local dev and tests never send.
 */
export const expoPushSender: PushSender = {
  async send(tokens, message) {
    if (process.env.EXPO_PUSH_ENABLED !== 'true' || tokens.length === 0) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({ to, title: message.title, body: message.body, data: message.data, sound: 'default' })),
      ),
    });
  },
};

let pushSender: PushSender = expoPushSender;

export function setPushSender(sender: PushSender) {
  pushSender = sender;
}

/** Write to the citizen's digital mailbox and fire a push notification. */
export function notify(
  store: Store,
  account: Account,
  message: Pick<InboxMessage, 'category' | 'title' | 'body' | 'link'>,
): InboxMessage {
  const entry: InboxMessage = {
    id: newId('msg'),
    accountId: account.id,
    createdAt: new Date().toISOString(),
    read: false,
    ...message,
  };
  store.inbox.set(entry.id, entry);
  void pushSender
    .send(account.pushTokens, { title: message.title, body: message.body, data: message.link ? { link: message.link } : undefined })
    .catch(() => {
      // Push is best-effort; the inbox entry is the durable record.
    });
  return entry;
}
