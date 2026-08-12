/**
 * Token 自动刷新管理器
 *
 * 功能：
 * 1. 检查 Token 是否过期或即将过期
 * 2. 自动调用 OAuth refresh_token 刷新
 * 3. 更新 IndexedDB 中的 CloudAccount
 * 4. API 调用 401 时自动重试一次
 */

import { db } from '../db';
import { refreshToken } from './oauth';
import type { CloudAccount } from '../../types';

// 提前刷新阈值：Token 过期前 5 分钟即触发刷新
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * 检查 Token 是否已过期或即将过期
 */
export function isTokenExpired(account: CloudAccount): boolean {
  return Date.now() + REFRESH_THRESHOLD_MS >= account.expiresAt;
}

/**
 * 刷新指定账户的 Token
 * 1. 调用 OAuth refreshToken API
 * 2. 更新 IndexedDB 中的账户记录
 * 3. 返回更新后的 CloudAccount
 */
export async function refreshAccountToken(account: CloudAccount): Promise<CloudAccount> {
  if (!account.refreshToken) {
    throw new Error(`${account.displayName} 没有 refresh_token，无法自动刷新，请重新连接`);
  }

  const result = await refreshToken(account.provider, account.refreshToken);

  const updatedAccount: CloudAccount = {
    ...account,
    accessToken: result.accessToken,
    // 部分服务商会轮换 refresh_token（如 Google），回写新值
    refreshToken: result.refreshToken || account.refreshToken,
    expiresAt: Date.now() + result.expiresIn * 1000,
  };

  // 更新 IndexedDB
  await db.cloudAccounts.update(account.id, {
    accessToken: result.accessToken,
    refreshToken: updatedAccount.refreshToken,
    expiresAt: updatedAccount.expiresAt,
  });

  return updatedAccount;
}

/**
 * 确保 Token 有效
 * - 如果 Token 未过期，直接返回原账户
 * - 如果 Token 已过期或即将过期，自动刷新后返回新账户
 */
export async function ensureValidToken(account: CloudAccount): Promise<CloudAccount> {
  if (!isTokenExpired(account)) {
    return account;
  }

  console.log(`[TokenManager] ${account.displayName} Token 即将过期，正在刷新...`);
  try {
    const updated = await refreshAccountTokenOnce(account);
    console.log(`[TokenManager] ${account.displayName} Token 刷新成功`);
    return updated;
  } catch (err) {
    console.error(`[TokenManager] ${account.displayName} Token 刷新失败:`, err);
    throw err;
  }
}

/**
 * 带 Token 自动刷新的 API 调用包装器
 *
 * 用法：
 * const result = await withRefresh(account, (acc) => adapter.upload(acc, path, data));
 *
 * 特性：
 * - 调用前自动检查 Token 有效期
 * - 遇到 401 错误自动刷新 Token 重试一次
 * - 返回 [result, updatedAccount] 元组
 */
export async function withRefresh<T>(
  account: CloudAccount,
  fn: (account: CloudAccount) => Promise<T>
): Promise<{ result: T; account: CloudAccount }> {
  // 调用前确保 Token 有效
  const validAccount = await ensureValidToken(account);

  try {
    const result = await fn(validAccount);
    return { result, account: validAccount };
  } catch (err: unknown) {
    // 仅当错误是 401 且 Token 确实可能过期时，尝试刷新一次
    const errMsg = err instanceof Error ? err.message : String(err);
    const isAuthError =
      errMsg.includes('401') ||
      errMsg.includes('Unauthorized') ||
      errMsg.toLowerCase().includes('token');

    if (!isAuthError) throw err;

    console.log(`[TokenManager] ${account.displayName} API 调用返回 401，尝试刷新 Token 后重试...`);

    try {
      const refreshedAccount = await refreshAccountTokenOnce(validAccount);
      const result = await fn(refreshedAccount);
      return { result, account: refreshedAccount };
    } catch (retryErr) {
      console.error(`[TokenManager] ${account.displayName} 刷新后重试仍失败:`, retryErr);
      throw retryErr;
    }
  }
}

/**
 * 获取所有已连接的云账户
 */
export async function getConnectedAccounts(): Promise<CloudAccount[]> {
  return db.cloudAccounts.toArray();
}

/**
 * 批量刷新所有已过期 Token
 * 返回：{ refreshed: number; failed: number }
 */
export async function refreshAllExpiredTokens(): Promise<{ refreshed: number; failed: number }> {
  const cutoff = Date.now() + REFRESH_THRESHOLD_MS;
  // 利用 expiresAt 索引，仅取即将过期的账户，避免全表扫描
  const accounts = await db.cloudAccounts
    .where('expiresAt')
    .below(cutoff)
    .toArray();
  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      await refreshAccountToken(account);
      refreshed++;
    } catch {
      failed++;
    }
  }

  return { refreshed, failed };
}

// 并发刷新去重：同一账户同时被多处触发刷新时，共享同一个 in-flight Promise
const refreshInFlight = new Map<string, Promise<CloudAccount>>();

export async function refreshAccountTokenOnce(account: CloudAccount): Promise<CloudAccount> {
  const existing = refreshInFlight.get(account.id);
  if (existing) return existing;

  const promise = refreshAccountToken(account).finally(() => {
    refreshInFlight.delete(account.id);
  });
  refreshInFlight.set(account.id, promise);
  return promise;
}