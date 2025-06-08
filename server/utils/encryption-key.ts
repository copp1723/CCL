import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure 32-byte encryption key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Retrieve the encryption key from environment variables.
 * The key should be stored in a secrets manager and injected at runtime.
 * Throws an error if the key is missing, default, or insecure.
 */
export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate a secure key and store it in your secrets manager.'
    );
  }

  if (key === 'default-key-change-in-production') {
    throw new Error('Default encryption key is insecure. Set a unique key via your secrets manager.');
  }

  if (Buffer.byteLength(key) < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 bytes long.');
  }

  return key;
}
