/**
 * Cryptographic helpers for client-side password hashing and salt generation.
 * Uses window.crypto.subtle for secure non-plaintext password hashing.
 */

export function generateSalt() {
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const activeSalt = salt || generateSalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(activeSalt + password + 'personal_expense_system_pepper');
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return salt ? hash : { hash, salt: activeSalt };
}

export async function verifyPassword(password, storedHash, salt) {
  const computedHash = await hashPassword(password, salt);
  return computedHash === storedHash;
}
