/**
 * 端到端加密模块 — 使用 Web Crypto API (AES-GCM)
 */

const KEY_STORAGE_KEY = 'memoflow-master-key';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(str: string): ArrayBuffer {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer;
}

// 生成随机主密钥
async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// 导出密钥为 Base64
async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufToBase64(raw);
}

// 从 Base64 导入密钥
async function importKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToBuf(base64);
  return crypto.subtle.importKey('raw', raw, { name: ALGORITHM, length: KEY_LENGTH }, false, ['encrypt', 'decrypt']);
}

// 使用密码派生密钥 (PBKDF2)
async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// 获取主密钥
export async function getMasterKey(): Promise<CryptoKey | null> {
  try {
    const stored = localStorage.getItem(KEY_STORAGE_KEY);
    if (stored) return importKey(stored);
    return null;
  } catch {
    return null;
  }
}

// 初始化主密钥
export async function initMasterKey(): Promise<CryptoKey> {
  const existing = await getMasterKey();
  if (existing) return existing;
  const key = await generateMasterKey();
  const exported = await exportKey(key);
  localStorage.setItem(KEY_STORAGE_KEY, exported);
  return key;
}

// 加密内容
export async function encryptContent(
  plaintext: string,
  key?: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encryptionKey = key || await getMasterKey();
  if (!encryptionKey) throw new Error('加密密钥未初始化');

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    encryptionKey,
    encoder.encode(plaintext)
  );

  return {
    encrypted: bufToBase64(encrypted),
    iv: bufToBase64(iv.buffer),
  };
}

// 解密内容
export async function decryptContent(
  encryptedBase64: string,
  ivBase64: string,
  key?: CryptoKey
): Promise<string> {
  const encryptionKey = key || await getMasterKey();
  if (!encryptionKey) throw new Error('加密密钥未初始化');

  const encrypted = base64ToBuf(encryptedBase64);
  const iv = new Uint8Array(base64ToBuf(ivBase64));

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    encryptionKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

// 设置锁定密码
export async function setLockPassword(password: string): Promise<void> {
  const key = await getMasterKey();
  if (!key) throw new Error('主密钥未初始化');

  const exported = await exportKey(key);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derivedKey = await deriveKey(password, salt.buffer);

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    derivedKey,
    encoder.encode(exported)
  );

  localStorage.setItem('memoflow-encrypted-key', JSON.stringify({
    data: bufToBase64(encrypted),
    iv: bufToBase64(iv.buffer),
    salt: bufToBase64(salt.buffer),
  }));
  localStorage.removeItem(KEY_STORAGE_KEY);
}

// 使用密码解锁
export async function unlockWithPassword(password: string): Promise<CryptoKey> {
  const stored = localStorage.getItem('memoflow-encrypted-key');
  if (!stored) throw new Error('未设置锁定密码');

  const { data, iv, salt } = JSON.parse(stored);
  const saltBytes = base64ToBuf(salt);
  const ivBytes = new Uint8Array(base64ToBuf(iv));
  const encryptedBytes = base64ToBuf(data);

  const derivedKey = await deriveKey(password, saltBytes);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    derivedKey,
    encryptedBytes
  );

  const exportedKey = new TextDecoder().decode(decrypted);
  const key = await importKey(exportedKey);
  sessionStorage.setItem(KEY_STORAGE_KEY, exportedKey);
  return key;
}

export function hasLockPassword(): boolean {
  return localStorage.getItem('memoflow-encrypted-key') !== null;
}

export async function getSessionKey(): Promise<CryptoKey | null> {
  const sessionStored = sessionStorage.getItem(KEY_STORAGE_KEY);
  if (sessionStored) return importKey(sessionStored);
  return getMasterKey();
}
