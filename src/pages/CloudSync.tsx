import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Check, Plus, RefreshCw, Settings as SettingsIcon, Trash2, Upload, AlertCircle } from 'lucide-react';
import { db } from '../lib/db';
import { cloudProviders, getAdapter, syncAllNotes } from '../lib/cloud/adapter';
import type { CloudProvider, CloudAccount } from '../types';

export function CloudSync() {
  const accounts = useLiveQuery(() => db.cloudAccounts.toArray(), []);
  const [connecting, setConnecting] = useState<CloudProvider | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; success: number; failed: number } | null>(null);

  const handleConnect = async (provider: CloudProvider) => {
    setConnecting(provider);
    try {
      const adapter = getAdapter(provider);
      const account = await adapter.connect({ apiKey: 'demo-key' });
      await db.cloudAccounts.add(account);
    } catch (e) {
      console.error('连接失败:', e);
    }
    setConnecting(null);
  };

  const handleDisconnect = async (account: CloudAccount) => {
    const adapter = getAdapter(account.provider);
    await adapter.disconnect(account);
    await db.cloudAccounts.delete(account.id);
  };

  const handleSync = async (account: CloudAccount) => {
    setSyncing(account.id);
    try {
      const notes = await db.notes.toArray();
      const result = await syncAllNotes(account, notes);
      setSyncResult({ id: account.id, ...result });
      await db.cloudAccounts.update(account.id, { lastSyncAt: Date.now() });
      // 更新笔记同步状态
      await db.notes.toCollection().modify({ syncStatus: 'synced' });
    } catch (e) {
      console.error('同步失败:', e);
    }
    setSyncing(null);
  };

  const connectedProviders = new Set(accounts?.map(a => a.provider));
  const availableProviders = (Object.keys(cloudProviders) as CloudProvider[]).filter(p => !connectedProviders.has(p));

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      <div className="mb-6 sm:mb-8">
        <h1 className="typo-title mb-1 sm:mb-2">云同步中心</h1>
        <p className="typo-body">连接你的网盘，让笔记自由流动</p>
      </div>

      {/* 已连接的网盘 */}
      {accounts && accounts.length > 0 && (
        <section className="mb-6 sm:mb-8">
          <h2 className="typo-section mb-3 sm:mb-4">已连接的网盘</h2>
          <div className="space-y-3">
            {accounts.map((account, i) => {
              const meta = cloudProviders[account.provider];
              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-4 sm:p-5"
                >
                  {/* 主体：图标 + 信息 */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* 图标 */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0" style={{ background: `${meta.color}20` }}>
                      {meta.icon}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="typo-section">{meta.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1" style={{ background: '#22c55e20', color: '#22c55e' }}>
                          <Check size={10} /> 已连接
                        </span>
                        {account.autoSync && (
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf' }}>
                            自动同步
                          </span>
                        )}
                      </div>
                      <p className="typo-meta mt-1 break-all">
                        <span className="block">远程路径: {account.remotePath}</span>
                        {account.lastSyncAt && <span className="block">上次同步: {new Date(account.lastSyncAt).toLocaleString('zh-CN')}</span>}
                      </p>
                    </div>
                  </div>

                  {/* 操作按钮：移动端独立一行 */}
                  <div className="flex items-center gap-2 mt-3 sm:mt-4">
                    <button
                      onClick={() => handleSync(account)}
                      disabled={syncing === account.id}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 flex-1 sm:flex-none justify-center"
                    >
                      {syncing === account.id ? (
                        <><RefreshCw size={14} className="animate-spin" /> 同步中...</>
                      ) : (
                        <><Upload size={14} /> 立即同步</>
                      )}
                    </button>
                    <button
                      onClick={() => handleDisconnect(account)}
                      className="w-9 h-9 rounded-xl glass flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* 同步结果 */}
                  <AnimatePresence>
                    {syncResult?.id === account.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-[var(--glass-border)]"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <Check size={16} className="text-[#22c55e]" />
                          <span className="typo-label">同步完成: 成功 {syncResult.success} 条, 失败 {syncResult.failed} 条</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* 可用网盘 */}
      <section>
        <h2 className="typo-section mb-3 sm:mb-4">添加网盘</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {(Object.keys(cloudProviders) as CloudProvider[]).map((provider, i) => {
            const meta = cloudProviders[provider];
            const isConnected = connectedProviders.has(provider);
            return (
              <motion.div
                key={provider}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`glass-card p-4 sm:p-5 ${isConnected ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0" style={{ background: `${meta.color}20` }}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="typo-section">{meta.name}</h3>
                    <p className="typo-meta mt-0.5 line-clamp-2">{meta.desc}</p>
                  </div>
                  {isConnected ? (
                    <span className="px-3 py-2 rounded-xl text-sm text-[#22c55e] flex items-center gap-1 shrink-0">
                      <Check size={16} /> 已添加
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConnect(provider)}
                      disabled={connecting === provider}
                      className="btn-primary flex items-center gap-2 text-sm shrink-0"
                    >
                      {connecting === provider ? (
                        <><RefreshCw size={14} className="animate-spin" /> 连接中</>
                      ) : (
                        <><Plus size={14} /> 连接</>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 说明 */}
      <div className="mt-6 sm:mt-8 glass-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-[var(--accent-ocean)] shrink-0 mt-0.5" />
          <div>
            <h3 className="typo-section mb-1">关于云同步</h3>
            <p className="typo-meta leading-relaxed">
              MemoFlow 采用「离线优先」架构，所有笔记首先存储在本地 IndexedDB，然后按需同步到云端。
              支持增量同步（仅上传变更内容）和冲突检测。数据以 JSON 格式加密上传，确保跨平台兼容。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
