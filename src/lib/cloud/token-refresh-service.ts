/**
 * Token 后台自动刷新服务
 *
 * 功能：
 * 1. 每隔 N 分钟检查所有已连接账户的 Token 有效期
 * 2. 自动刷新即将过期的 Token
 * 3. 应用启动时自动检查一次
 * 4. 支持手动启动/停止
 */

import { refreshAllExpiredTokens } from './token-manager';

// 默认检查间隔：10 分钟
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

type RefreshCallback = (result: { refreshed: number; failed: number }) => void;

export class TokenRefreshService {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;
  private onRefresh: RefreshCallback | null = null;

  constructor(intervalMs: number = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  /**
   * 设置刷新回调（用于 UI 更新通知）
   */
  setOnRefresh(callback: RefreshCallback): void {
    this.onRefresh = callback;
  }

  /**
   * 启动后台刷新服务
   * - 立即执行一次检查
   * - 然后按间隔定时执行
   */
  start(): void {
    if (this.timerId !== null) return;

    console.log(`[TokenRefreshService] 已启动，检查间隔: ${this.intervalMs / 1000}s`);

    // 立即执行一次
    this.check();

    // 定时执行
    this.timerId = setInterval(() => this.check(), this.intervalMs);
  }

  /**
   * 停止后台刷新服务
   */
  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('[TokenRefreshService] 已停止');
    }
  }

  /**
   * 立即执行一次 Token 检查与刷新
   */
  async check(): Promise<void> {
    try {
      const result = await refreshAllExpiredTokens();
      if (result.refreshed > 0 || result.failed > 0) {
        console.log(`[TokenRefreshService] 检查完成: 刷新 ${result.refreshed} 个, 失败 ${result.failed} 个`);
      }
      this.onRefresh?.(result);
    } catch (err) {
      console.error('[TokenRefreshService] 检查异常:', err);
    }
  }

  /**
   * 是否正在运行
   */
  get isRunning(): boolean {
    return this.timerId !== null;
  }
}

// 单例导出
export const tokenRefreshService = new TokenRefreshService();
