/**
 * 敏感凭据加密存储助手
 *
 * 基于既有 AES-GCM 主密钥（crypto/index.ts），为云端 token 提供透明加解密。
 * 配合 Dexie 的 creating/updating/reading 钩子使用：
 * - 写入 IndexedDB 前自动加密 accessToken / refreshToken
 * - 从 IndexedDB 读取后自动解密
 *
 * 这样各适配器仍以明文使用 account.accessToken，但磁盘上仅存密文。
 */

import { encryptContent, decryptContent, initMasterKey } from './index';

export interface EncryptedField {
  data: string;
  iv: string;
}

/** 加密一段明文，返回 { data, iv } */
export async function encryptSecret(plaintext: string): Promise<EncryptedField> {
  const key = await initMasterKey();
  return encryptContent(plaintext, key);
}

/** 解密由 encryptSecret 产生的密文 */
export async function decryptSecret(secret: EncryptedField): Promise<string> {
  const key = await initMasterKey();
  return decryptContent(secret.data, secret.iv, key);
}

/** 判断一个 token 字段是否已被加密 */
export function isEncryptedField(value: unknown): value is EncryptedField {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as EncryptedField).data === 'string' &&
    typeof (value as EncryptedField).iv === 'string'
  );
}
