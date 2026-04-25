// AstraChat - Client-side Encryption Module
// Uses Web Crypto API with AES-GCM

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const STORAGE_KEY = 'astrachat_encryption_key'

/**
 * Generate a new AES-GCM encryption key
 */
export async function generateKey() {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
  return key
}

/**
 * Export key to base64 string for storage
 */
export async function exportKey(key) {
  const exported = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(exported)))
}

/**
 * Import key from base64 string
 */
export async function importKey(base64Key) {
  const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Save encryption key to localStorage
 */
export async function saveKeyToStorage(key) {
  const exported = await exportKey(key)
  localStorage.setItem(STORAGE_KEY, exported)
}

/**
 * Load encryption key from localStorage, or generate new one
 */
export async function loadOrCreateKey() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return await importKey(stored)
    } catch {
      // Key corrupted, generate new one
    }
  }
  const key = await generateKey()
  await saveKeyToStorage(key)
  return key
}

/**
 * Encrypt plaintext message
 * @returns {{ ciphertext: string, iv: string }}
 */
export async function encryptMessage(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()
  const encoded = encoder.encode(plaintext)

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  )

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

/**
 * Decrypt ciphertext message
 * @returns {string} plaintext
 */
export async function decryptMessage(ciphertext, ivBase64, key) {
  try {
    const encrypted = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    return '[Pesan tidak dapat didekripsi]'
  }
}
