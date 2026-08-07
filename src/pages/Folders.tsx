import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Folder as FolderIcon, Plus, ArrowRight, Briefcase, Home as HomeIcon, Lightbulb, type LucideIcon } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../store/useStore';

const FOLDER_ICONS: Record<string, LucideIcon> = {
  '💼': Briefcase,
  '🏡': HomeIcon,
  '💡': Lightbulb,
};

export function Folders() {
  const { navigateTo, setSelectedFolderId, addRecentItem } = useStore();
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const [showCreator, setShowCreator] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📁');

  const handleFolderClick = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    addRecentItem(folderId, folderName, 'folder');
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

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="typo-title">文件夹</h1>
        <button
          onClick={() => setShowCreator(true)}
          className="glass w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
          title="新建文件夹"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
              className="glass-card p-5 text-left flex items-center gap-4"
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
              <ArrowRight size={18} className="text-[var(--text-secondary)] shrink-0" />
            </motion.button>
          );
        })}
      </div>

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
