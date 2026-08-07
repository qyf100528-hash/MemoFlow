import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Home, FileText, Star, Cloud, Package, Settings, Plus, Tag as TagIcon, Edit2, Trash2, Check, X, Briefcase, Lightbulb, Folder as FolderIcon, type LucideIcon } from 'lucide-react';
import { db } from '../../lib/db';
import { useStore } from '../../store/useStore';
import type { Tag } from '../../types';

const FOLDER_ICONS: Record<string, LucideIcon> = {
  '💼': Briefcase,
  '🏡': Home,
  '💡': Lightbulb,
};

const TAG_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#2dd4bf', '#38bdf8', '#a78bfa', '#ec4899', '#64748b'];

export function Sidebar() {
  const {
    currentPage, navigateTo, goHome,
    selectedFolderId, setSelectedFolderId,
    selectedTagId, setSelectedTagId,
    setShowFavorites, setShowAllNotes,
    showFavorites, showAllNotes,
  } = useStore();

  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const pinnedCount = useLiveQuery(() => db.notes.filter(n => n.isPinned).count(), []);
  const allCount = useLiveQuery(() => db.notes.filter(n => !n.isArchived).count(), []);

  // 标签编辑状态
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0]);

  // 点击首页时使用 store 的 goHome，清空历史栈并重置筛选
  // goHome 直接从 useStore 解构使用

  const navItems = [
    { id: 'home', label: '首页', icon: Home, action: goHome },
    { id: 'notes', label: '全部笔记', icon: FileText, count: allCount, action: () => { setShowAllNotes(true); navigateTo('notes'); } },
    { id: 'favorites', label: '置顶', icon: Star, action: () => { setShowFavorites(true); navigateTo('notes'); } },
  ];

  const cloudItems = [
    { id: 'cloud', label: '云同步', icon: Cloud },
    { id: 'migration', label: '数据迁移', icon: Package },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  // ============ 标签操作 ============
  const startCreateTag = () => {
    setEditingTagId('new');
    setTagName('');
    setTagColor(TAG_COLORS[0]);
    setShowTagEditor(true);
  };

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagColor(tag.color);
    setShowTagEditor(true);
  };

  const saveTag = async () => {
    const name = tagName.trim();
    if (!name) return;
    if (editingTagId === 'new') {
      await db.tags.add({
        id: `tag-${Date.now()}`,
        name,
        color: tagColor,
        createdAt: Date.now(),
      });
    } else if (editingTagId) {
      await db.tags.update(editingTagId, { name, color: tagColor });
    }
    setShowTagEditor(false);
    setEditingTagId(null);
    setTagName('');
  };

  const deleteTag = async (tagId: string) => {
    if (!confirm('确定删除此标签？将同时从所有笔记中移除。')) return;
    const notesWithTag = await db.notes.where('tagIds').equals(tagId).toArray();
    for (const note of notesWithTag) {
      await db.notes.update(note.id, { tagIds: note.tagIds.filter(id => id !== tagId) });
    }
    await db.tags.delete(tagId);
    if (selectedTagId === tagId) setSelectedTagId(null);
  };

  const cancelEdit = () => {
    setShowTagEditor(false);
    setEditingTagId(null);
    setTagName('');
  };

  // 统一的激活样式判断
  const isNavActive = (itemId: string) => {
    if (itemId === 'home') return currentPage === 'home' && !showFavorites && !showAllNotes;
    if (itemId === 'favorites') return showFavorites;
    if (itemId === 'notes') return showAllNotes;
    return currentPage === itemId;
  };

  return (
    <aside className="ios-glass flex flex-col h-full safe-top" style={{ width: 240, borderRight: '0.5px solid rgba(255, 255, 255, 0.12)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-gradient)' }}>
          <svg viewBox="0 0 64 64" className="w-5 h-5" fill="none">
            <path d="M20 22h24M20 32h24M20 42h16" stroke="white" strokeWidth="4" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-lg font-bold gradient-text">MemoFlow</span>
      </div>

      {/* 新建笔记 */}
      <div className="px-4 pb-3">
        <button
          onClick={() => { navigateTo('editor'); useStore.getState().setSelectedNoteId(null); }}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={18} /> 新建笔记
        </button>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => item.action ? item.action() : navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={active ? { background: 'rgba(45, 212, 191, 0.15)' } : {}}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs opacity-50">{item.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 文件夹 — 统一白色简约风格 */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">文件夹</span>
          </div>
          <div className="space-y-1">
            {folders?.map((f) => {
              const active = selectedFolderId === f.id && !showFavorites && !showAllNotes;
              return (
                <button
                  key={f.id}
                  onClick={() => { setSelectedFolderId(f.id); navigateTo('notes'); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  style={active ? { background: 'rgba(45, 212, 191, 0.15)' } : {}}
                >
                  {(() => { const FIC = FOLDER_ICONS[f.icon] || FolderIcon; return <FIC size={18} />; })()}
                  <span className="flex-1 text-left">{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 标签 — 支持自定义 */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
              <TagIcon size={12} /> 标签
            </span>
            <button
              onClick={startCreateTag}
              className="text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
              title="新建标签"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* 标签编辑器 */}
          {showTagEditor && (
            <div className="px-3 mb-2 ios-glass p-3 space-y-2" style={{ borderRadius: 12 }}>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTag()}
                placeholder="标签名称"
                autoFocus
                className="w-full text-sm px-2 py-1.5 ios-glass-btn rounded-lg placeholder:text-[var(--text-secondary)]"
              />
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTagColor(c)}
                    className="w-5 h-5 rounded-full transition-transform"
                    style={{
                      background: c,
                      transform: tagColor === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: tagColor === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveTag} className="flex-1 btn-primary text-xs py-1.5 flex items-center justify-center gap-1">
                  <Check size={12} /> 保存
                </button>
                <button onClick={cancelEdit} className="ios-glass-btn px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {/* 标签列表 */}
          <div className="space-y-1 px-3">
            {tags?.map((t) => {
              const active = selectedTagId === t.id;
              return (
                <div key={t.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => { setSelectedTagId(t.id); navigateTo('notes'); }}
                    className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    style={{
                      background: active ? t.color : `${t.color}15`,
                      border: `1px solid ${t.color}30`,
                    }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="truncate">{t.name}</span>
                  </button>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={() => startEditTag(t)}
                      className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)]"
                      title="重命名"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => deleteTag(t.id)}
                      className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400"
                      title="删除"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
            {(!tags || tags.length === 0) && !showTagEditor && (
              <button
                onClick={startCreateTag}
                className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--accent-mint)] py-2 transition-colors"
              >
                + 创建第一个标签
              </button>
            )}
          </div>
        </div>

        {/* 底部导航 */}
        <div className="mt-6 space-y-1 pb-4">
          {cloudItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={active ? { background: 'rgba(45, 212, 191, 0.15)' } : {}}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
