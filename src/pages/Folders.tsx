import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Folder as FolderIcon, Plus, ArrowRight, Briefcase, Home as HomeIcon, Lightbulb, List, Grid, Check, type LucideIcon } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';

const FOLDER_ICONS: Record<string, LucideIcon> = {
  '💼': Briefcase,
  '🏡': HomeIcon,
  '💡': Lightbulb,
};

export function Folders() {
  const { navigateTo, setSelectedFolderId, settings, setFoldersViewMode } = useStore();
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const [showCreator, setShowCreator] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📁');

  const handleFolderClick = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    navigateTo('notes');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const count = await db.folders.count();
    await db.folders.add({
      id: `folder-${Date.now()}`,
      name: newName.trim(),
      icon: newIcon,
      color: '#2dd4bf',
      parentId: null,
      sortOrder: count,
      createdAt: Date.now(),
    });
    setNewName('');
    setNewIcon('📁');
    setShowCreator(false);
  };

  const FOLDER_ICON_OPTIONS = ['📁', '💼', '🏡', '💡', '📝', '⭐', '📌', '🎯', '📚', '🎨', '🎵', '✈️', '🏠', '❤️', '🔥', '🌟'];

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

      {/* 网格视图 — 卡片式 */}
      {settings.foldersViewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders?.map((f, i) => {
            const Icon = FOLDER_ICONS[f.icon] || FolderIcon;
            return (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                onClick={() => handleFolderClick(f.id, f.name)}
                className="glass-card p-4 text-left flex flex-col gap-3"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${f.color}20` }}>
                  <Icon size={24} style={{ color: f.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="typo-note-title truncate">{f.name}</div>
                  <div className="typo-meta mt-1">
                    {f.id.startsWith('folder-cloud-') ? '云端同步' : '本地'}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* 列表视图 — Apple Notes 圆润质感，与笔记列表统一 */}
      {settings.foldersViewMode === 'list' && (
        <div className="glass-card rounded-[28px] overflow-hidden">
          {folders?.map((f, i) => {
            const Icon = FOLDER_ICONS[f.icon] || FolderIcon;
            return (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleFolderClick(f.id, f.name)}
                className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
                style={i < (folders?.length || 0) - 1 ? { borderBottom: '1px solid var(--glass-border)' } : {}}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${f.color}20` }}>
                  <Icon size={20} style={{ color: f.color }} />
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
        <div className="z-50 bg-black/40 backdrop-blur-sm" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }} onClick={() => { setShowCreator(false); setNewName(''); setNewIcon('📁'); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-2xl p-5 sm:p-6 w-full max-w-sm"
          >
            <h3 className="typo-section mb-4">新建文件夹</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              placeholder="文件夹名称"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--accent-mint)] transition-colors"
            />
            {/* 图标选择器 */}
            <div className="mt-3">
              <p className="typo-meta mb-2">选择图标</p>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {FOLDER_ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewIcon(icon)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-lg transition-all ${newIcon === icon ? 'bg-[var(--accent-mint)]/20 ring-1 ring-[var(--accent-mint)]' : 'hover:bg-white/5'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowCreator(false); setNewName(''); setNewIcon('📁'); }} className="flex-1 px-4 py-2.5 rounded-xl glass typo-body">取消</button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">创建</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
