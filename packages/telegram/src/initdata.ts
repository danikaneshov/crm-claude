// ==========================================
// Telegram initData Validation
// ==========================================
// Official Telegram documentation:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

import { createHmac } from 'crypto';
import type { TelegramUser } from '@crm/shared';
import { INIT_DATA_MAX_AGE_SECONDS } from '@crm/shared';

export class InitDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitDataValidationError';
  }
}

/**
 * Validate Telegram Mini App initData.
 *
 * Algorithm:
 * 1. Parse initData as URLSearchParams
 * 2. Extract `hash`
 * 3. Sort remaining params alphabetically
 * 4. Form data-check-string (key=value pairs joined by \n)
 * 5. HMAC-SHA256(secret_key, data-check-string) === hash
 * 6. Check auth_date is not too old
 *
 * @returns Validated Telegram user
 * @throws InitDataValidationError if validation fails
 */
export function validateInitData(initData: string, botToken: string): TelegramUser {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new InitDataValidationError('Missing hash in initData');
  }

  // Remove hash from params for validation
  params.delete('hash');

  // Sort params alphabetically and form data-check-string
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create secret key: HMAC-SHA256 of bot token with "WebAppData" as key
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculate expected hash
  const expectedHash = createHmac('sha256', secretKey)
    .update(sortedParams)
    .digest('hex');

  // Compare hashes
  if (hash !== expectedHash) {
    throw new InitDataValidationError('Invalid initData hash');
  }

  // Check auth_date
  const authDate = params.get('auth_date');
  if (!authDate) {
    throw new InitDataValidationError('Missing auth_date in initData');
  }

  const authTimestamp = parseInt(authDate, 10);
  const now = Math.floor(Date.now() / 1000);

  if (now - authTimestamp > INIT_DATA_MAX_AGE_SECONDS) {
    throw new InitDataValidationError('initData is too old');
  }

  // Extract user data
  const userData = params.get('user');
  if (!userData) {
    throw new InitDataValidationError('Missing user in initData');
  }

  try {
    const user = JSON.parse(userData) as TelegramUser;
    if (!user.id) {
      throw new InitDataValidationError('Missing user.id in initData');
    }
    return user;
  } catch (e) {
    if (e instanceof InitDataValidationError) throw e;
    throw new InitDataValidationError('Invalid user JSON in initData');
  }
}
