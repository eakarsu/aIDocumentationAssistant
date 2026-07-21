import crypto from 'crypto';

const IV_LENGTH = 12;
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const configured = process.env.ENCRYPTION_KEY;
  if (!configured || /default|change|replace|example|your[-_ ]?key/i.test(configured)) {
    throw new Error('ENCRYPTION_KEY must be configured with 32 random bytes');
  }
  if (/^[a-f0-9]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');
  const base64 = Buffer.from(configured, 'base64');
  if (base64.length === 32 && base64.toString('base64').replace(/=+$/, '') === configured.replace(/=+$/, '')) return base64;
  const utf8 = Buffer.from(configured, 'utf8');
  if (utf8.length === 32) return utf8;
  throw new Error('ENCRYPTION_KEY must be 32 bytes encoded as hex, base64, or exact UTF-8');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return ['v2', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(text: string): string {
  const [version, ivHex, tagHex, encryptedHex] = text.split(':');
  if (version !== 'v2' || !ivHex || !tagHex || !encryptedHex) throw new Error('Unsupported encrypted value format; rotate this credential');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
