/**
 * 后台自动同步服务
 *
 * 功能：
 * 1. 每隔 N 分钟检查所有已连接且 autoSync=true 的账户
 * 2. 自动同步笔记到云端
 * 3. 同步结束后处理重试队列
 * 4. 应用启动时自动检查一次
 */

import { db } from '../db';
import { syncAllNotes } from './adapter';
import { processRetryQueue } from './sync-queue';

// 默认检查间隔：15 分钟
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

export interface SyncResult {
  accountId: string;
  provider: string;
  success: number;
  failed: number;
  retried: number;
  error?: string;
}

type SyncCallback = (result: SyncResult) => void;

export class SyncService {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;
  private onSync: SyncCallback | null = null;
  private isRunning = false;

  constructor(intervalMs: number = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  /**
   * 设置同步回调（用于 UI 更新通知）
   */
  setOnSync(callback: SyncCallback): void {
    this.onSync = callback;
  }

  /**
   * 启动后台同步服务
   */
  start(): void {
    if (this.timerId !== null) return;

    console.log(`[SyncService] 已启动，同步间隔: ${this.intervalMs / 1000}s`);

    // 立即执行一次
    this.syncAll();

    // 定时执行
    this.timerId = setInterval(() => this.syncAll(), this.intervalMs);
  }

  /**
   * 停止后台同步服务
   */
  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('[SyncService] 已停止');
    }
  }

  /**
   * 立即执行一次全量同步
   */
  async syncAll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const accounts = await db.cloudAccounts
        .filter(a => a.isConnected && a.autoSync)
        .toArray();

      if (accounts.length === 0) return;

      console.log(`[SyncService] 开始自动同步 ${accounts.length} 个账户...`);

      for (const account of accounts) {
        try {
          const notes = await db.notes.toArray();
          const result = await syncAllNotes(account, notes);
          const retried = await processRetryQueue(account);
          await db.cloudAccounts.update(account.id, { lastSyncAt: Date.now() });

          this.onSync?.({
            accountId: account.id,
            provider: account.provider,
            ...result,
            retried,
          });
        } catch (e) {
          console.error(`[SyncService] 账户 ${account.provider} 同步失败:`, e);
          this.onSync?.({
            accountId: account.id,
            provider: account.provider,
            success: 0,
            failed: 0,
            retried: 0,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } catch (err) {
      console.error('[SyncService] 同步异常:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 是否正在运行
   */
  get active(): boolean {
    return this.timerId !== null;
  }
}

// 单例导出
export const syncService = new SyncService();