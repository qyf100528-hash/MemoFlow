/**
 * 云同步重试队列
 *
 * 功能：
 * 1. 同步失败时入队，等待重试
 * 2. 指数退避重试（1s → 2s → 4s → 8s → 最大 30s）
 * 3. 最多重试 3 次，超限标记为永久失败
 * 4. 队列持久化到 IndexedDB（syncQueue 表，字段完整落库）
 */

import { db } from '../db';
import { getAdapter } from './adapter';
import { withRefresh } from './token-manager';
import type { CloudAccount, CloudProvider, SyncQueueItem } from '../../types';

const MAX_RETRIES = 3;
const MAX_BACKOFF = 30000;
const INITIAL_BACKOFF = 1000;

// 记录日志，避免日志失败影响主流程
async function logSync(
  noteId: string,
  action: SyncQueueItem['action'],
  provider: CloudProvider,
  status: 'success' | 'failed' | 'pending',
  message?: string
): Promise<void> {
  try {
    await db.syncLogs.add({
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      noteId: noteId || '',
      action,
      provider,
      timestamp: Date.now(),
      status,
      message,
    });
  } catch {
    // 日志记录失败不影响主流程
  }
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
    id: `syncq-${now}-${Math.random().toString(36).slice(2, 8)}`,
    accountId: account.id,
    provider: account.provider,
    action,
    path,
    data,
    noteId,
    retries: 0,
    lastError: error,
    nextRetryAt: now + INITIAL_BACKOFF,
    createdAt: now,
  };

  try {
    await db.syncQueue.add(item);
  } catch (e) {
    console.error('[SyncQueue] 入队失败:', e);
    return;
  }
  await logSync(noteId || '', action, account.provider, 'failed', error);
}

/**
 * 从队列中取出一条到期且未超限的待重试任务（按账户过滤）
 */
async function dequeueNext(account: CloudAccount): Promise<SyncQueueItem | null> {
  const now = Date.now();
  const candidates = await db.syncQueue
    .where('accountId')
    .equals(account.id)
    .filter(item => item.nextRetryAt <= now && item.retries < MAX_RETRIES)
    .sortBy('nextRetryAt');
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * 处理重试队列 — 依次尝试重试当前账户所有到期失败项
 * 在每次同步操作后调用
 */
export async function processRetryQueue(account: CloudAccount): Promise<number> {
  const adapter = getAdapter(account.provider);
  let processed = 0;

  while (true) {
    const item = await dequeueNext(account);
    if (!item) break;

    processed++;
    try {
      const doRetry = async (acc: CloudAccount) => {
        // 按操作类型分发：删除走 deleteFile，新增/更新走 upload
        if (item.action === 'delete') {
          await adapter.deleteFile(acc, item.path);
        } else {
          await adapter.upload(acc, item.path, new Blob([item.data || ''], { type: 'application/json' }));
        }
      };

      await withRefresh(account, doRetry);
      await db.syncQueue.delete(item.id);
      await logSync(item.noteId || '', item.action, account.provider, 'success');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '重试失败';
      const retryCount = item.retries + 1;
      const backoff = Math.min(INITIAL_BACKOFF * Math.pow(2, retryCount), MAX_BACKOFF);

      if (retryCount >= MAX_RETRIES) {
        console.warn(`[SyncQueue] ${item.path} 重试 ${MAX_RETRIES} 次后仍失败，放弃`);
        // 保留一条失败审计日志后移除队列项
        await logSync(item.noteId || '', item.action, account.provider, 'failed', errMsg);
        await db.syncQueue.delete(item.id);
      } else {
        await db.syncQueue.update(item.id, {
          retries: retryCount,
          lastError: errMsg,
          nextRetryAt: Date.now() + backoff,
        });
      }
    }
  }

  return processed;
}

/**
 * 获取指定账户当前待重试数量
 */
export async function getPendingCount(accountId: string): Promise<number> {
  const now = Date.now();
  return db.syncQueue
    .where('accountId')
    .equals(accountId)
    .filter(item => item.nextRetryAt <= now && item.retries < MAX_RETRIES)
    .count();
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
