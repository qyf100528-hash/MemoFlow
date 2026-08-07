import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pin, Lock, Unlock, Eye, Edit3, Sparkles, Tag as TagIcon, Folder as FolderIcon, Check, ArrowLeft, Trash2, History, Link2, MoreHorizontal, FileText } from 'lucide-react';
import { db } from '../../lib/db';
import { useStore } from '../../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Note, NoteVersion, Attachment } from '../../types';
import { initMasterKey, encryptContent, decryptContent, getSessionKey, hasLockPassword, unlockWithPassword } from '../../lib/crypto';
import { saveVersionSnapshot } from '../../lib/version-history';
import { VersionHistory } from './VersionHistory';
import { AIPanel } from './AIPanel';
import { BacklinksPanel } from './BacklinksPanel';
import { TemplatePicker } from './TemplatePicker';
import { resolveLinks, renderLinksAsHtml, getLinkSuggestions } from '../../lib/links/link-parser';
import type { Note as NoteType } from '../../types';

export function NoteEditor() {
  const { selectedNoteId, setSelectedNoteId, goBack } = useStore();
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);

  const [note, setNote] = useState<Note | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<NoteType[]>([]);
  const [showLinkSuggest, setShowLinkSuggest] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [decrypting, setDecrypting] = useState(false);
  const [encryptPassword, setEncryptPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedContent = useRef<string>('');

  // 应用模板
  const applyTemplate = (content: string, title: string) => {
    if (!note) return;
    setNote({ ...note, content, title: title || note.title });
    setShowTemplatePicker(false);
    setSaveStatus('unsaved');
  };

  // 数据验证 — 标题长度和内容大小
  const validateNote = (n: Note): string | null => {
    if (n.title.length > 200) return '标题不能超过 200 个字符';
    if (n.content.length > 500000) return '笔记内容不能超过 500KB';
    return null;
  };

  useEffect(() => { initMasterKey(); }, []);

  useEffect(() => {
    if (selectedNoteId) {
      db.notes.get(selectedNoteId).then(async (n) => {
        if (!n) return;
        if (n.isEncrypted && n.encryptedContent) {
          try {
            const sessionKey = await getSessionKey();
            if (sessionKey) {
              const { encrypted, iv } = JSON.parse(n.encryptedContent);
              const decrypted = await decryptContent(encrypted, iv, sessionKey);
              setNote({ ...n, content: decrypted, plainText: '' });
            } else {
              setNote(n);
            }
          } catch {
            setNote(n);
          }
        } else {
          setNote(n);
        }
      });
    } else {
      const now = Date.now();
      setNote({
        id: `note-${now}`,
        title: '',
        content: '',
        plainText: '',
        folderId: null,
        tagIds: [],
        isPinned: false,
        isLocked: false,
        isArchived: false,
        isEncrypted: false,
        attachments: [],
        createdAt: now,
        updatedAt: now,
        syncStatus: 'local',
      });
      setSaveStatus('unsaved');
      setShowTemplatePicker(true);
    }
  }, [selectedNoteId]);

  const saveNote = async (updated?: Note) => {
    if (!updated && !note) return;
    const n = { ...(updated || note!) };
    n.updatedAt = Date.now();
    n.plainText = n.content.replace(/[#*`>\-|_\[\]()]/g, '').slice(0, 500);

    if (selectedNoteId) {
      await saveVersionSnapshot(n);
    }

    if (n.isLocked && n.content) {
      try {
        const sessionKey = await getSessionKey();
        if (sessionKey) {
          const { encrypted, iv } = await encryptContent(n.content, sessionKey);
          n.encryptedContent = JSON.stringify({ encrypted, iv });
          n.isEncrypted = true;
          n.content = '[内容已加密]';
          n.plainText = '[内容已加密]';
        }
      } catch (e) {
        console.error('加密失败:', e);
      }
    } else {
      n.isEncrypted = false;
      n.encryptedContent = undefined;
    }

    setSaveStatus('saving');
    await db.notes.put(n);
    if (n.isEncrypted) {
      const original = updated || note!;
      n.content = original.content;
      n.plainText = original.plainText;
    }
    setNote(n);
    setSaveStatus('saved');
  };

  const handleChange = (field: keyof Note, value: string | boolean | string[] | null | Attachment[]) => {
    if (!note) return;
    const updated = { ...note, [field]: value };

    // 数据验证
    if (field === 'title' || field === 'content') {
      const error = validateNote(updated);
      if (error) {
        console.warn('数据验证失败:', error);
        return;
      }
    }

    setNote(updated);
    setSaveStatus('unsaved');

    // 内容变化检测：只在实际内容变化时才触发保存
    if (field === 'content' || field === 'title') {
      const contentKey = `${updated.title}|${updated.content}`;
      if (contentKey === lastSavedContent.current) return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lastSavedContent.current = `${updated.title}|${updated.content}`;
      saveNote(updated);
    }, 1500);
  };

  const handleContentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    const beforeCursor = value.slice(0, cursorPos);

    // 检测 [[ 模式
    const linkMatch = beforeCursor.match(/\[\[([^\]]*)$/);
    if (linkMatch) {
      const query = linkMatch[1];
      setLinkQuery(query);
      setShowLinkSuggest(true);
      getLinkSuggestions(query, note?.id).then(setLinkSuggestions);
    } else {
      setShowLinkSuggest(false);
    }

    handleChange('content', value);
  };

  const insertLink = (targetTitle: string) => {
    if (!note) return;
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const before = note.content.slice(0, cursorPos);
    const after = note.content.slice(cursorPos);
    // 替换 [[query 为 [[title]]
    const newBefore = before.replace(/\[\[([^\]]*)$/, `[[${targetTitle}]]`);
    const newContent = newBefore + after;
    handleChange('content', newContent);
    setShowLinkSuggest(false);
    // 设置光标位置
    setTimeout(() => {
      const newPos = newBefore.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  };

  const handlePreviewLinkClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('note-link')) {
      e.preventDefault();
      const noteId = target.getAttribute('data-note-id');
      if (noteId) {
        setSelectedNoteId(noteId);
      }
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    await db.notes.delete(note.id);
    goBack();
    setSelectedNoteId(null);
  };

  const handleLockToggle = async () => {
    if (!note) return;
    if (note.isLocked) {
      if (hasLockPassword()) {
        setShowPasswordInput(true);
      } else {
        const pwd = prompt('设置锁定密码：');
        if (pwd) {
          await unlockWithPassword(pwd);
          await handleChange('isLocked', true);
        }
      }
    } else {
      await handleChange('isLocked', true);
    }
  };

  const handleUnlock = async () => {
    if (!note || !encryptPassword) return;
    try {
      setDecrypting(true);
      const key = await unlockWithPassword(encryptPassword);
      if (note.encryptedContent) {
        const { encrypted, iv } = JSON.parse(note.encryptedContent);
        const decrypted = await decryptContent(encrypted, iv, key);
        setNote({ ...note, content: decrypted, isLocked: false });
      }
      setShowPasswordInput(false);
      setEncryptPassword('');
    } catch (e) {
      alert('密码错误');
    } finally {
      setDecrypting(false);
    }
  };

  const handleRollback = (version: NoteVersion) => {
    if (!note) return;
    setNote({
      ...note,
      title: version.title,
      content: version.content,
      plainText: version.plainText,
      updatedAt: Date.now(),
    });
    setSaveStatus('unsaved');
  };

  if (!note) return <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">加载中...</div>;

  const noteTags = tags?.filter(t => note.tagIds.includes(t.id)) || [];
  const currentFolder = folders?.find(f => f.id === note.folderId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 glass" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        {/* 返回 — 始终显示 */}
        <button onClick={() => { saveNote(); goBack(); setSelectedNoteId(null); }} className="glass w-9 h-9 rounded-xl flex items-center justify-center hover:text-[var(--accent-mint)] transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => setShowTemplatePicker(true)} className="glass w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0 hidden sm:flex" title="选择模板">
          <FileText size={18} />
        </button>

        {/* 预览切换 — 始终显示 */}
        <button onClick={() => setIsPreview(!isPreview)} className={`glass w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 md:hidden ${isPreview ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)]'}`}>
          {isPreview ? <Edit3 size={18} /> : <Eye size={18} />}
        </button>

        <div className="w-px h-6 bg-[var(--glass-border)] mx-0.5 hidden sm:block" />

        {/* 桌面端按钮组 */}
        <button onClick={() => handleChange('isPinned', !note.isPinned)} className={`hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-colors shrink-0 ${note.isPinned ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          <Pin size={18} className={note.isPinned ? 'fill-current' : ''} />
        </button>
        <button onClick={handleLockToggle} className={`hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-colors shrink-0 ${note.isLocked ? 'text-[var(--accent-ocean)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          {note.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
        </button>

        <div className="relative hidden sm:block">
          <button onClick={() => setShowFolderPicker(!showFolderPicker)} className="glass px-3 h-9 rounded-xl flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <FolderIcon size={15} />
            {currentFolder ? `${currentFolder.icon} ${currentFolder.name}` : '文件夹'}
          </button>
          {showFolderPicker && (
            <div className="absolute top-11 left-0 glass-strong rounded-xl p-2 min-w-[160px] z-50">
              <button onClick={() => { handleChange('folderId', null); setShowFolderPicker(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-[var(--text-secondary)]">无</button>
              {folders?.map(f => (
                <button key={f.id} onClick={() => { handleChange('folderId', f.id); setShowFolderPicker(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 flex items-center gap-2 text-[var(--text-primary)]">
                  <span>{f.icon}</span> {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative hidden sm:block">
          <button onClick={() => setShowTagPicker(!showTagPicker)} className="glass px-3 h-9 rounded-xl flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <TagIcon size={15} />
            {noteTags.length > 0 ? `${noteTags.length} 个标签` : '标签'}
          </button>
          {showTagPicker && (
            <div className="absolute top-11 left-0 glass-strong rounded-xl p-2 min-w-[160px] z-50">
              {tags?.map(t => {
                const selected = note.tagIds.includes(t.id);
                return (
                  <button key={t.id} onClick={() => {
                    const newTags = selected ? note.tagIds.filter(id => id !== t.id) : [...note.tagIds, t.id];
                    handleChange('tagIds', newTags);
                  }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                    <span className="text-[var(--text-primary)]">{t.name}</span>
                    {selected && <Check size={14} className="text-[var(--accent-mint)] ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* 桌面端右侧按钮 */}
        <button onClick={() => { setShowAIPanel(!showAIPanel); setShowHistory(false); setShowBacklinks(false); }} className={`hidden sm:flex glass px-3 h-9 rounded-xl items-center gap-2 text-sm transition-colors shrink-0 ${showAIPanel ? 'text-[var(--accent-violet)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          <Sparkles size={15} /> AI
        </button>
        <button onClick={() => { setShowHistory(!showHistory); setShowAIPanel(false); setShowBacklinks(false); }} className={`hidden sm:flex glass px-3 h-9 rounded-xl items-center gap-2 text-sm transition-colors shrink-0 ${showHistory ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          <History size={15} /> 历史
        </button>
        <button onClick={() => { setShowBacklinks(!showBacklinks); setShowAIPanel(false); setShowHistory(false); }} className={`hidden sm:flex glass px-3 h-9 rounded-xl items-center gap-2 text-sm transition-colors shrink-0 ${showBacklinks ? 'text-[var(--accent-ocean)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`} title="反向链接">
          <Link2 size={15} /> 链接
        </button>
        <button onClick={() => setIsPreview(!isPreview)} className={`hidden sm:flex glass px-3 h-9 rounded-xl items-center gap-2 text-sm transition-colors shrink-0 ${isPreview ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          {isPreview ? <Edit3 size={15} /> : <Eye size={15} />} {isPreview ? '编辑' : '预览'}
        </button>
        <button onClick={handleDelete} className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={18} />
        </button>

        {/* 移动端「更多」菜单 */}
        <div className="relative sm:hidden">
          <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="glass w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] shrink-0">
            <MoreHorizontal size={18} />
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute top-11 right-0 glass-strong rounded-xl p-2 min-w-[180px] z-50 space-y-0.5">
                <button onClick={() => { handleChange('isPinned', !note.isPinned); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <Pin size={16} className={note.isPinned ? 'text-[var(--accent-mint)] fill-current' : ''} /> {note.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button onClick={() => { handleLockToggle(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  {note.isLocked ? <Lock size={16} className="text-[var(--accent-ocean)]" /> : <Unlock size={16} />} {note.isLocked ? '解锁' : '锁定'}
                </button>
                <div className="h-px bg-[var(--glass-border)] my-1" />
                <button onClick={() => { setShowFolderPicker(!showFolderPicker); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <FolderIcon size={16} /> {currentFolder ? `${currentFolder.icon} ${currentFolder.name}` : '选择文件夹'}
                </button>
                <button onClick={() => { setShowTagPicker(!showTagPicker); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <TagIcon size={16} /> {noteTags.length > 0 ? `${noteTags.length} 个标签` : '添加标签'}
                </button>
                <div className="h-px bg-[var(--glass-border)] my-1" />
                <button onClick={() => { setShowAIPanel(!showAIPanel); setShowHistory(false); setShowBacklinks(false); setShowMoreMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 ${showAIPanel ? 'text-[var(--accent-violet)]' : 'text-[var(--text-primary)]'}`}>
                  <Sparkles size={16} /> AI 助手
                </button>
                <button onClick={() => { setShowHistory(!showHistory); setShowAIPanel(false); setShowBacklinks(false); setShowMoreMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 ${showHistory ? 'text-[var(--accent-mint)]' : 'text-[var(--text-primary)]'}`}>
                  <History size={16} /> 版本历史
                </button>
                <button onClick={() => { setShowBacklinks(!showBacklinks); setShowAIPanel(false); setShowHistory(false); setShowMoreMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 ${showBacklinks ? 'text-[var(--accent-ocean)]' : 'text-[var(--text-primary)]'}`}>
                  <Link2 size={16} /> 反向链接
                </button>
                <div className="h-px bg-[var(--glass-border)] my-1" />
                <button onClick={() => { setShowTemplatePicker(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <FileText size={16} /> 选择模板
                </button>
                <div className="h-px bg-[var(--glass-border)] my-1" />
                <button onClick={() => { handleDelete(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-red-400">
                  <Trash2 size={16} /> 删除笔记
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 移动端文件夹选择器 */}
      {showFolderPicker && (
        <div className="sm:hidden px-3 py-2 glass border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2 mb-2">
            <FolderIcon size={16} className="text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">选择文件夹</span>
            <button onClick={() => setShowFolderPicker(false)} className="ml-auto text-xs text-[var(--text-secondary)]">完成</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => { handleChange('folderId', null); setShowFolderPicker(false); }} className="glass px-3 py-1.5 rounded-lg text-sm whitespace-nowrap text-[var(--text-secondary)]">无</button>
            {folders?.map(f => (
              <button key={f.id} onClick={() => { handleChange('folderId', f.id); setShowFolderPicker(false); }} className={`glass px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${note.folderId === f.id ? 'text-[var(--accent-mint)]' : 'text-[var(--text-primary)]'}`}>
                {f.icon} {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 移动端标签选择器 */}
      {showTagPicker && (
        <div className="sm:hidden px-3 py-2 glass border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2 mb-2">
            <TagIcon size={16} className="text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">标签</span>
            <button onClick={() => setShowTagPicker(false)} className="ml-auto text-xs text-[var(--text-secondary)]">完成</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tags?.map(t => {
              const selected = note.tagIds.includes(t.id);
              return (
                <button key={t.id} onClick={() => {
                  const newTags = selected ? note.tagIds.filter(id => id !== t.id) : [...note.tagIds, t.id];
                  handleChange('tagIds', newTags);
                }} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${selected ? 'glass text-[var(--accent-mint)]' : 'glass text-[var(--text-secondary)]'}`}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                  {t.name}
                  {selected && <Check size={12} />}
                </button>
              );
            })}
            {(!tags || tags.length === 0) && (
              <span className="text-xs text-[var(--text-secondary)]">暂无标签，请在设置中创建</span>
            )}
          </div>
        </div>
      )}

      {/* 模板选择器 */}
      {showTemplatePicker && note && (
        <TemplatePicker
          onSelect={applyTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {/* 密码输入 */}
      {showPasswordInput && (
        <div className="px-3 sm:px-6 py-3 glass border-b border-[var(--glass-border)]">
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
            <input type="password" value={encryptPassword} onChange={(e) => setEncryptPassword(e.target.value)} placeholder="输入锁定密码..." className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-[var(--glass-border)] text-sm" onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} />
            <button onClick={handleUnlock} disabled={decrypting} className="glass px-4 py-2 rounded-xl text-sm text-[var(--accent-mint)] hover:bg-white/10">
              {decrypting ? '解密中...' : '解锁'}
            </button>
            <button onClick={() => { setShowPasswordInput(false); setEncryptPassword(''); }} className="text-sm text-[var(--text-secondary)]">取消</button>
          </div>
        </div>
      )}

      {/* 编辑区 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-[var(--text-secondary)]">
              {saveStatus === 'saving' ? '⏳ 保存中...' : saveStatus === 'unsaved' ? '✏️ 未保存' : '✅ 已保存'}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date(note.updatedAt).toLocaleString('zh-CN')}
            </span>
          </div>

          {/* AI 面板 */}
          {showAIPanel && selectedNoteId && note && (
            <div className="mb-4">
              <AIPanel
                note={note}
                onApplyTags={(tagIds) => {
                  const updated = { ...note, tagIds: [...new Set([...note.tagIds, ...tagIds])] };
                  setNote(updated);
                  setSaveStatus('unsaved');
                }}
                onClose={() => setShowAIPanel(false)}
              />
            </div>
          )}

          {/* 版本历史面板 */}
          {showHistory && selectedNoteId && (
            <div className="mb-4">
              <VersionHistory
                noteId={selectedNoteId}
                onClose={() => setShowHistory(false)}
                onRollback={handleRollback}
              />
            </div>
          )}

          {/* 反向链接面板 */}
          {showBacklinks && selectedNoteId && (
            <div className="mb-4">
              <BacklinksPanel
                noteId={selectedNoteId}
                onNoteClick={(id) => { setSelectedNoteId(id); setShowBacklinks(false); }}
              />
            </div>
          )}

          {note.isLocked && note.isEncrypted && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--accent-ocean)]/10 border border-[var(--accent-ocean)]/20 text-sm text-[var(--accent-ocean)]">
              此笔记已加密，锁定状态下内容不可见。
            </div>
          )}

          <input type="text" value={note.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="无标题"
            className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 w-full placeholder:text-[var(--text-secondary)]"
            disabled={note.isLocked && note.isEncrypted} />

          {isPreview ? (
            <div className="markdown-body text-[var(--text-primary)] leading-relaxed" onClick={handlePreviewLinkClick} id="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {note.content || '*还没有内容，切换到编辑模式开始写作...*'}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="relative">
              {showLinkSuggest && linkSuggestions.length > 0 && (
                <div className="absolute z-50 glass-strong rounded-xl p-2 max-w-md max-h-48 overflow-y-auto" style={{ bottom: '100%', marginBottom: '4px' }}>
                  <p className="text-xs text-[var(--text-secondary)] px-2 py-1">链接到笔记</p>
                  {linkSuggestions.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => insertLink(n.title)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)] flex items-center gap-2"
                    >
                      <Link2 size={12} className="text-[var(--accent-ocean)]" />
                      <span className="truncate">{n.title || '无标题'}</span>
                    </button>
                  ))}
                </div>
              )}
              <textarea value={note.content} onChange={handleContentInput}
                placeholder="开始书写你的想法...  使用 [[ 笔记名 ]] 创建链接"
                className="w-full min-h-[500px] leading-relaxed resize-none placeholder:text-[var(--text-secondary)]"
                style={{ fontSize: 'var(--font-size-base, 16px)' }}
                disabled={note.isLocked && note.isEncrypted} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
