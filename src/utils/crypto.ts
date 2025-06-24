import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 128 bit

// Validate and get secret key from environment
function getSecretKey(): string {
  const key = process.env.AES_SECRET_KEY;
  if (!key) {
    throw new Error('AES_SECRET_KEY environment variable is required');
  }
  if (key.length !== 32) {
    throw new Error('AES_SECRET_KEY must be exactly 32 bytes');
  }
  return key;
}

export function encrypt(text: string): string {
  const secretKey = getSecretKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

export function decrypt(encrypted: string): string {
  const secretKey = getSecretKey();
  const [ivStr, encText] = encrypted.split(':');
  if (!ivStr || !encText) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivStr, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(secretKey), iv);
  let decrypted = decipher.update(encText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
} 