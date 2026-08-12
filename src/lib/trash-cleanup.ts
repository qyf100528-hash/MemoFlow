import { db } from './db';

/**
 * 回收站自动清理服务
 *
 * 启动后定时检查归档笔记，超过保留天数的笔记会从数据库中永久删除。
 * 通过 start() / stop() 控制生命周期，App 启动时启动，组件卸载时停止。
 *
 * 清理频率: 每小时检查一次 + 启动时立即执行一次。
 */
class TrashCleanupService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCleanupAt = 0;

  start() {
    if (this.timer) return;
    // 启动时立即跑一次
    void this.cleanup();
    this.timer = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 强制清理一次（被设置变更触发等场景） */
  async forceCleanup(retentionDays: number): Promise<number> {
    return this.cleanupByRetention(retentionDays);
  }

  private async cleanup(): Promise<number> {
    // 节流：避免高频触发 (60 秒内不重复)
    if (Date.now() - this.lastCleanupAt < 60_000) return 0;
    this.lastCleanupAt = Date.now();
    const { settings } = await import('../store/useStore').then(m => m.useStore.getState());
    const days = settings.trashRetentionDays ?? 30;
    return this.cleanupByRetention(days);
  }

  /**
   * 删除归档时间超过 retentionDays 天的笔记
   * retentionDays = 0 表示永久保留，跳过清理
   */
  private async cleanupByRetention(retentionDays: number): Promise<number> {
    if (retentionDays <= 0) return 0;
    const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    // 归档时间(updatedAt)早于阈值的笔记视为过期
    const expired = await db.notes
      .filter(n => !!n.isArchived && n.updatedAt < threshold)
      .toArray();
    if (expired.length === 0) return 0;
    const ids = expired.map(n => n.id);
    await db.transaction('rw', db.notes, async () => {
      await db.notes.bulkDelete(ids);
    });
    console.log(`[trash-cleanup] 已永久清理 ${expired.length} 条过期笔记 (保留天数=${retentionDays})`);
    return expired.length;
  }
}

export const trashCleanupService = new TrashCleanupService();