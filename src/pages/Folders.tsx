import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Folder as FolderIcon, Plus, ArrowRight, List, Grid, Check, Smartphone, Cloud } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';
import { FOLDER_ICON_OPTIONS, DEFAULT_FOLDER_ICON, getFolderIcon } from '../lib/folderIcons';

export function Folders() {
  const { navigateTo, setSelectedFolderId, settings, setFoldersViewMode } = useStore();
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const cloudAccounts = useLiveQuery(() => db.cloudAccounts.toArray(), []);
  const connectedClouds = cloudAccounts?.filter(a => a.isConnected).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) || [];
  const [showCreator, setShowCreator] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(DEFAULT_FOLDER_ICON);
  const [newFolderLocation, setNewFolderLocation] = useState<'local' | string>('local');

  const CLOUD_LABELS: Record<string, string> = {
    baidu: '百度网盘',
    google: 'Google Drive',
    quark: '夸克网盘',
    onedrive: 'OneDrive',
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    navigateTo('notes');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const count = await db.folders.count();
    const isCloud = newFolderLocation !== 'local';
    const folderId = isCloud ? `folder-cloud-${newFolderLocation}-${Date.now()}` : `folder-${Date.now()}`;
    await db.folders.add({
      id: folderId,
      name: newName.trim(),
      icon: newIcon,
      color: '#2dd4bf',
      parentId: null,
      sortOrder: count,
      createdAt: Date.now(),
    });
    setNewName('');
    setNewIcon(DEFAULT_FOLDER_ICON);
    setNewFolderLocation('local');
    setShowCreator(false);
  };

  const folderViewModes = [
    { mode: 'list' as const, icon: List, label: '列表' },
    { mode: 'grid' as const, icon: Grid, label: '网格' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      {/* 头部 — 与置顶笔记/全部笔记统一布局：标题左侧，视图切换+新建右侧同一行 */}
      <div className="flex items-center justify-between mb-6 pt-14 md:pt-0">
        <div>
          <h1 className="typo-title">文件夹</h1>
          <p className="typo-meta mt-1">{folders?.length || 0} 个文件夹</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 视图切换 — 毛玻璃容器 */}
          <div className="relative">
            <button
              onClick={() => setShowViewPicker(!showViewPicker)}
              className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
              title="切换视图"
            >
              <Grid size={18} />
            </button>
            {showViewPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowViewPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-11 right-0 glass-strong rounded-2xl p-1.5 min-w-[140px] z-50 space-y-0.5"
                >
                  {folderViewModes.map(({ mode, icon: Icon, label }) => {
                    const active = settings.foldersViewMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => { setFoldersViewMode(mode); setShowViewPicker(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                          active ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                        style={active ? { background: 'rgba(45, 212, 191, 0.12)' } : {}}
                      >
                        <Icon size={16} />
                        <span className="flex-1 text-left">{label}</span>
                        {active && <Check size={14} />}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </div>
          {/* 新建文件夹 — ios-glass-btn 与视图切换同质感 */}
          <button
            onClick={() => setShowCreator(true)}
            className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
            title="新建文件夹"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 网格视图 — 与主页笔记网格统一风格 */}
      {settings.foldersViewMode === 'grid' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {folders?.map((f, i) => {
            const Icon = getFolderIcon(f.icon);
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => handleFolderClick(f.id, f.name)}
                className="cursor-pointer group flex flex-col"
              >
                {/* 卡片主体 — 与笔记网格统一 */}
                <div className="note-grid-card-inner flex flex-col">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${f.color}20` }}>
                      <Icon size={15} style={{ color: f.color }} />
                    </div>
                    {f.id.startsWith('folder-cloud-') && (
                      <span className="typo-caption text-[var(--accent-violet)]">云</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-[1.55] flex-1">
                    {f.id.startsWith('folder-cloud-') ? '云端同步' : '本地存储'}
                  </p>
                </div>
                {/* 外部标题区 — Apple Notes 风格 */}
                <div className="mt-1.5 px-0.5">
                  <div className="text-xs font-semibold text-[var(--text-primary)] truncate leading-tight group-hover:text-[var(--accent-mint)] transition-colors text-center">
                    {f.name}
                  </div>
                  <div className="typo-caption mt-0.5 leading-tight text-center">
                    {f.id.startsWith('folder-cloud-') ? '云端同步' : '本地'}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 列表视图 — 统一独立胶囊卡片 */}
      {settings.foldersViewMode === 'list' && (
        <div className="space-y-2">
          {folders?.map((f, i) => {
            const Icon = getFolderIcon(f.icon);
            return (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleFolderClick(f.id, f.name)}
                className="ios-pill-note w-full text-left flex items-center gap-3 px-4 py-2.5"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${f.color}20` }}>
                  <Icon size={15} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="typo-note-title truncate">{f.name}</div>
                  <div className="typo-meta mt-0.5">
                    {f.id.startsWith('folder-cloud-') ? '云端同步' : '本地'}
                  </div>
                </div>
                <ArrowRight size={16} className="text-[var(--text-secondary)] shrink-0" />
              </motion.button>
            );
          })}
        </div>
      )}

      {showCreator && (
        <div className="z-50 bg-black/20" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }} onClick={() => { setShowCreator(false); setNewName(''); setNewIcon(DEFAULT_FOLDER_ICON); setNewFolderLocation('local'); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-[28px] p-5 sm:p-6 w-full max-w-sm"
          >
            <h3 className="typo-title mb-5">新建文件夹</h3>

            {/* 名称输入 — iOS 风格圆角输入框 */}
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              placeholder="文件夹名称"
              className="w-full px-4 py-3 rounded-2xl bg-white/8 border-0 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:bg-white/12 transition-colors"
            />

            {/* 保存位置 — 分组列表，iOS Settings 风格 */}
            <div className="mt-4">
              <p className="typo-meta mb-2 px-1">保存位置</p>
              <div className="ios-pill-note overflow-hidden">
                {/* 本地 */}
                <button
                  onClick={() => setNewFolderLocation('local')}
                  className="icon-press w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  style={newFolderLocation !== 'local' ? { borderBottom: '0.5px solid var(--glass-border)' } : {}}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#2dd4bf20' }}>
                    <Smartphone size={17} style={{ color: '#2dd4bf' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="typo-note-title">本地</div>
                  </div>
                  {newFolderLocation === 'local' && <Check size={16} className="text-[var(--accent-mint)] shrink-0" />}
                </button>
                {/* 已连接网盘 */}
                {connectedClouds.map((cloud, idx) => {
                  const isLast = idx === connectedClouds.length - 1;
                  const active = newFolderLocation === cloud.provider;
                  return (
                    <button
                      key={cloud.id}
                      onClick={() => setNewFolderLocation(cloud.provider)}
                      className="icon-press w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                      style={!isLast ? { borderBottom: '0.5px solid var(--glass-border)' } : {}}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#a78bfa20' }}>
                        <Cloud size={17} style={{ color: '#a78bfa' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="typo-note-title">{CLOUD_LABELS[cloud.provider] || cloud.displayName}</div>
                      </div>
                      {active && <Check size={16} className="text-[var(--accent-mint)] shrink-0" />}
                    </button>
                  );
                })}
                {connectedClouds.length === 0 && (
                  <div className="px-4 py-3 text-center">
                    <span className="typo-meta">未连接网盘，</span>
                    <button
                      onClick={() => { setShowCreator(false); setNewName(''); setNewIcon(DEFAULT_FOLDER_ICON); setNewFolderLocation('local'); navigateTo('cloud'); }}
                      className="typo-meta text-[var(--accent-mint)]"
                    >
                      去连接
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 图标选择 — lucide 线条图标，与统计卡片风格统一 */}
            <div className="mt-4">
              <p className="typo-meta mb-2 px-1">选择图标</p>
              <div className="grid grid-cols-8 gap-2">
                {FOLDER_ICON_OPTIONS.map(key => {
                  const Icon = getFolderIcon(key);
                  const active = newIcon === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setNewIcon(key)}
                      className={`icon-press aspect-square rounded-xl flex items-center justify-center transition-all ${
                        active
                          ? 'ring-1 ring-[var(--accent-mint)]'
                          : 'ring-0.5 ring-[var(--glass-border)]'
                      }`}
                      style={{
                        background: active
                          ? 'rgba(45, 212, 191, 0.15)'
                          : 'var(--glass-bg)',
                      }}
                    >
                      <Icon size={18} className={active ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)]'} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 操作按钮 — iOS 风格 */}
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => { setShowCreator(false); setNewName(''); setNewIcon(DEFAULT_FOLDER_ICON); setNewFolderLocation('local'); }}
                className="icon-press flex-1 px-4 py-3 rounded-2xl ios-glass typo-body text-center"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="icon-press flex-1 btn-primary text-sm disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
