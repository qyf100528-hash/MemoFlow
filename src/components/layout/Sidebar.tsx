import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Home, FileText, Star, Cloud, Package, Settings, Plus, Tag as TagIcon, Edit2, Trash2, Check, X, Folder as FolderIcon, Clock, ChevronDown, ChevronRight, Trash, type LucideIcon } from 'lucide-react';
import { db } from '../../lib/db';
import { useStore } from '../../store/useStore';
import { getFolderIcon } from '../../lib/folderIcons';
import type { Tag } from '../../types';

const TAG_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#2dd4bf', '#38bdf8', '#a78bfa', '#ec4899', '#64748b'];

const MAX_VISIBLE = 5;

// 最近记录的图标映射
const RECENT_ICONS: Record<string, LucideIcon> = {
  'home': Home,
  'allNotes': FileText,
  'pinned': Star,
  'cloud': Cloud,
  'folder': FolderIcon,
  'note': FileText,
  'tag': TagIcon,
};

export function Sidebar() {
  const {
    currentPage, navigateFromMenu, goHome,
    selectedFolderId, setSelectedFolderId,
    selectedTagId, setSelectedTagId,
    setShowFavorites, setShowAllNotes,
    showFavorites, showAllNotes,
    recentItems, addRecentItem,
    sidebarScrollPos, setSidebarScrollPos,
  } = useStore();

  const navRef = useRef<HTMLElement>(null);
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const allCount = useLiveQuery(() => db.notes.filter(n => !n.isArchived).count(), []);

  // 保存侧边栏滚动位置
  const saveScrollPos = () => {
    if (navRef.current) {
      setSidebarScrollPos(navRef.current.scrollTop);
    }
  };

  // 实时监听滚动并保存位置
  const handleNavScroll = () => {
    if (navRef.current) {
      setSidebarScrollPos(navRef.current.scrollTop);
    }
  };

  // 恢复侧边栏滚动位置（等数据加载完成后再恢复）
  useEffect(() => {
    if (navRef.current && sidebarScrollPos > 0) {
      requestAnimationFrame(() => {
        if (navRef.current) navRef.current.scrollTop = sidebarScrollPos;
      });
    }
  }, [sidebarScrollPos, folders, tags]);

  // 侧边栏关闭时保存滚动位置（兜底）
  useEffect(() => {
    return () => { saveScrollPos(); };
  }, []);

  const [showTagEditor, setShowTagEditor] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0]);
  const [foldersExpanded, setFoldersExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const navItems = [
    { id: 'home', label: '首页', icon: Home, action: goHome },
    { id: 'notes', label: '全部笔记', icon: FileText, count: allCount, action: () => { setShowAllNotes(true); navigateFromMenu('notes'); } },
    { id: 'favorites', label: '置顶', icon: Star, action: () => { setShowFavorites(true); navigateFromMenu('notes'); } },
  ];

  const cloudItems = [
    { id: 'cloud', label: '云同步', icon: Cloud },
    { id: 'migration', label: '数据迁移', icon: Package },
    { id: 'settings', label: '设置', icon: Settings },
    { id: 'trash', label: '回收站', icon: Trash },
  ];

  const handleFolderClick = (folderId: string, folderName: string) => {
    saveScrollPos();
    setSelectedFolderId(folderId);
    navigateFromMenu('notes');
  };

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
      await db.tags.add({ id: `tag-${Date.now()}`, name, color: tagColor, createdAt: Date.now() });
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

  const isNavActive = (itemId: string) => {
    if (itemId === 'home') return currentPage === 'home' && !showFavorites && !showAllNotes;
    if (itemId === 'favorites') return showFavorites;
    if (itemId === 'notes') return showAllNotes;
    return currentPage === itemId;
  };

  const visibleFolders = folders?.slice(0, MAX_VISIBLE) || [];
  const hiddenFolders = folders?.slice(MAX_VISIBLE) || [];
  const visibleTags = tags?.slice(0, MAX_VISIBLE) || [];
  const hiddenTags = tags?.slice(MAX_VISIBLE) || [];

  const renderFolderButton = (f: NonNullable<typeof folders>[number]) => {
    const active = selectedFolderId === f.id && !showFavorites && !showAllNotes;
    const Icon = getFolderIcon(f.icon);
    return (
      <button
        key={f.id}
        onClick={() => handleFolderClick(f.id, f.name)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
          active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
        style={active ? { background: 'rgba(45, 212, 191, 0.15)' } : {}}
      >
        <Icon size={18} />
        <span className="flex-1 text-left truncate">{f.name}</span>
      </button>
    );
  };

  const renderTagItem = (t: Tag) => {
    const active = selectedTagId === t.id;
    return (
      <div key={t.id} className="group flex items-center gap-1">
        <button
          onClick={() => { saveScrollPos(); setSelectedTagId(t.id); navigateFromMenu('notes'); }}
          className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
            active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          style={{ background: active ? t.color : `${t.color}15`, border: `1px solid ${t.color}30` }}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
          <span className="truncate">{t.name}</span>
        </button>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button onClick={() => startEditTag(t)} className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)]" title="重命名">
            <Edit2 size={11} />
          </button>
          <button onClick={() => deleteTag(t.id)} className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400" title="删除">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    );
  };

  const handleRecentClick = (item: typeof recentItems[number]) => {
    saveScrollPos();
    if (item.icon === 'note') {
      useStore.getState().setSelectedNoteId(item.id);
      navigateFromMenu('editor');
    } else if (item.id === 'allNotes') { setShowAllNotes(true); navigateFromMenu('notes'); }
    else if (item.id === 'pinned') { setShowFavorites(true); navigateFromMenu('notes'); }
    else if (item.id === 'home') { goHome(); }
    else if (item.id.startsWith('folder-cloud-')) { setSelectedFolderId(item.id); navigateFromMenu('notes'); }
    else if (item.id.startsWith('folder-')) { setSelectedFolderId(item.id); navigateFromMenu('notes'); }
    else { setSelectedTagId(item.id); navigateFromMenu('notes'); }
  };

  return (
    <aside className="ios-glass flex flex-col h-full safe-top" style={{ width: 240, borderRight: '0.5px solid rgba(255, 255, 255, 0.12)' }}>
      {/* Logo — 点击展开首页标题 */}
      <div
        className="flex items-center gap-3 px-5 py-5 cursor-pointer select-none"
        onClick={() => { goHome(); useStore.getState().setHomeTitleCollapsed(false); }}
      >
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
          onClick={() => { saveScrollPos(); navigateFromMenu('editor'); useStore.getState().setSelectedNoteId(null); }}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={18} /> 新建笔记
        </button>
      </div>

      {/* 导航 */}
      <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => { saveScrollPos(); item.action ? item.action() : navigateFromMenu(item.id); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={active ? { background: 'rgba(45, 212, 191, 0.15)' } : {}}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count !== undefined && <span className="text-xs opacity-50">{item.count}</span>}
              </button>
            );
          })}
        </div>

        {/* 文件夹 */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">文件夹</span>
          </div>
          <div className="space-y-1">
            {visibleFolders.map(renderFolderButton)}
            {hiddenFolders.length > 0 && (
              <>
                {foldersExpanded && hiddenFolders.map(renderFolderButton)}
                <button
                  onClick={() => setFoldersExpanded(!foldersExpanded)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  {foldersExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>{foldersExpanded ? '收起' : `更多… (${hiddenFolders.length})`}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 标签 */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
              <TagIcon size={12} /> 标签
            </span>
            <button onClick={startCreateTag} className="text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors" title="新建标签">
              <Plus size={14} />
            </button>
          </div>

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

          <div className="space-y-1 px-3">
            {visibleTags.map(renderTagItem)}
            {hiddenTags.length > 0 && (
              <>
                {tagsExpanded && hiddenTags.map(renderTagItem)}
                <button
                  onClick={() => setTagsExpanded(!tagsExpanded)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  {tagsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{tagsExpanded ? '收起' : `更多… (${hiddenTags.length})`}</span>
                </button>
              </>
            )}
            {(!tags || tags.length === 0) && !showTagEditor && (
              <button onClick={startCreateTag} className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--accent-mint)] py-2 transition-colors">
                + 创建第一个标签
              </button>
            )}
          </div>
        </div>

        {/* 底部导航 */}
        <div className="mt-6 space-y-1">
          {cloudItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { saveScrollPos(); navigateFromMenu(item.id); }}
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

        {/* 最近 — 所有导航记录 */}
        {recentItems.length > 0 && (
          <div className="mt-4 pb-4">
            <div className="flex items-center gap-1 px-3 mb-2">
              <Clock size={12} className="text-[var(--text-secondary)]" />
              <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">最近</span>
            </div>
            <div className="space-y-1">
              {recentItems.map((item) => {
                const Icon = RECENT_ICONS[item.icon] || FolderIcon;
                const active = selectedFolderId === item.id || (item.id === 'allNotes' && showAllNotes) || (item.id === 'pinned' && showFavorites);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleRecentClick(item)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs transition-all ${
                      active ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    style={active ? { background: 'rgba(45, 212, 191, 0.15)' } : {}}
                  >
                    <Icon size={14} />
                    <span className="flex-1 text-left truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
