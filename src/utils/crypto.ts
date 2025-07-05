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

// 암호화/복호화 없이 평문 반환
export function encrypt(text: string): string {
  return text;
}

export function decrypt(encrypted: string): string {
  return encrypted;
} 