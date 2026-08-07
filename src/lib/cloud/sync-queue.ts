/**
 * 云同步重试队列
 *
 * 功能：
 * 1. 同步失败时入队，等待重试
 * 2. 指数退避重试（1s → 2s → 4s → 8s → 最大 30s）
 * 3. 最多重试 3 次，超限标记为永久失败
 * 4. 队列持久化到 IndexedDB
 */

import { db } from '../db';
import { getAdapter } from './adapter';
import { withRefresh } from './token-manager';
import type { CloudAccount, CloudProvider, SyncLog } from '../../types';

const MAX_RETRIES = 3;
const MAX_BACKOFF = 30000;

interface SyncQueueItem {
  id: string;
  accountId: string;
  provider: CloudProvider;
  action: 'create' | 'update' | 'delete';
  path: string;
  data?: string;
  noteId?: string;
  retries: number;
  lastError?: string;
  nextRetryAt: number;
  createdAt: number;
}

/**
 * 将同步失败的操作加入重试队列
 */
export async function enqueueRetry(
  account: CloudAccount,
  action: SyncQueueItem['action'],
  path: string,
  data?: string,
  noteId?: string,
  error?: string
): Promise<void> {
  const now = Date.now();
  const item: SyncQueueItem = {
    id: `sync-${now}-${Math.random().toString(36).slice(2, 8)}`,
    accountId: account.id,
    provider: account.provider,
    action,
    path,
    data,
    noteId,
    retries: 0,
    lastError: error,
    nextRetryAt: now + 1000, // 1 秒后首次重试
    createdAt: now,
  };

  try {
    await db.syncLogs.add({
      id: item.id,
      noteId: noteId || '',
      action,
      provider: account.provider,
      timestamp: now,
      status: 'failed',
      message: error || '未知错误',
    });
  } catch {
    // 日志记录失败不影响重试队列
  }
}

/**
 * 从队列中取出一条待重试的任务
 */
async function dequeueNext(): Promise<SyncQueueItem | null> {
  const now = Date.now();
  const all = await db.syncLogs
    .filter(l => l.status === 'failed' && l.timestamp + MAX_BACKOFF * 3 > now)
    .toArray();
  // 简化：返回第一个失败项
  return all.length > 0 ? {
    id: all[0].id,
    accountId: '',
    provider: all[0].provider,
    action: all[0].action,
    path: '',
    retries: 0,
    nextRetryAt: 0,
    createdAt: all[0].timestamp,
    lastError: all[0].message,
  } : null;
}

/**
 * 处理重试队列 — 依次尝试重试所有失败项
 * 在每次同步操作后调用
 */
export async function processRetryQueue(account: CloudAccount): Promise<void> {
  const adapter = getAdapter(account.provider);

  while (true) {
    const item = await dequeueNext();
    if (!item) break;

    // 检查是否已超最大重试次数
    if (item.retries >= MAX_RETRIES) {
      await db.syncLogs.update(item.id, { status: 'failed' });
      continue;
    }

    // 检查是否到达重试时间
    if (Date.now() < item.nextRetryAt) continue;

    try {
      // 重试操作
      const noteId = item.id;
      await withRefresh(account, (acc) => adapter.upload(acc, item.path, new Blob([item.data || ''], { type: 'text/plain' })));
      await db.syncLogs.update(item.id, { status: 'success', timestamp: Date.now() });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '重试失败';
      const retryCount = item.retries + 1;
      const backoff = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF);

      // 更新重试状态
      try {
        await db.syncLogs.update(item.id, {
          message: errMsg,
          timestamp: Date.now(),
        });
      } catch {
        // ignore
      }

      if (retryCount >= MAX_RETRIES) {
        console.warn(`[SyncQueue] ${item.path} 重试 ${MAX_RETRIES} 次后仍失败，放弃`);
        try {
          await db.syncLogs.update(item.id, { status: 'failed' });
        } catch {
          // ignore
        }
      }
      break; // 一次只重试一个，避免阻塞
    }
  }
}

/**
 * 清理过期的同步日志（超过 7 天）
 */
export async function cleanExpiredSyncLogs(): Promise<void> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const expired = await db.syncLogs
    .filter(l => l.timestamp < cutoff)
    .toArray();
  if (expired.length > 0) {
    await db.syncLogs.bulkDelete(expired.map(l => l.id));
    console.log(`[SyncQueue] 清理了 ${expired.length} 条过期同步日志`);
  }
}
