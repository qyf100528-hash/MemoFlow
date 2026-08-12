import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Pin, Lock, Unlock, Edit3, Sparkles, Tag as TagIcon, Folder as FolderIcon, Check, ArrowLeft, Trash2, History, Link2, MoreHorizontal, FileText, Cloud, FolderInput, Loader2, Share2, Bold, Italic, Heading1, List, Code2, Quote, Eye, Download } from 'lucide-react';
import { db } from '../../lib/db';
import { useStore } from '../../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Note, NoteVersion, Attachment } from '../../types';
import { initMasterKey, encryptContent, decryptContent, getSessionKey, hasLockPassword, unlockWithPassword } from '../../lib/crypto';
import { saveVersionSnapshot } from '../../lib/version-history';
import { getFolderIcon } from '../../lib/folderIcons';
import { VersionHistory } from './VersionHistory';
import { AIPanel } from './AIPanel';
import { BacklinksPanel } from './BacklinksPanel';
import { TemplatePicker } from './TemplatePicker';
import { getLinkSuggestions } from '../../lib/links/link-parser';
import { exportNoteAsMarkdown } from '../../lib/export';
import type { Note as NoteType } from '../../types';

export function NoteEditor() {
  const { selectedNoteId, setSelectedNoteId, goBack, resolvedTheme, addRecentItem, selectedFolderId, showFavorites, showAllNotes } = useStore();
  const folders = useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  const cloudAccounts = useLiveQuery(() => db.cloudAccounts.filter(a => a.isConnected).toArray(), []);

  const [note, setNote] = useState<Note | null>(null);
  // 手动保存模式：默认阅读模式，新建笔记自动进入编辑模式
  const [isEditing, setIsEditing] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#2dd4bf');
  const [showHistory, setShowHistory] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSaveLocation, setShowSaveLocation] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<NoteType[]>([]);
  const [showLinkSuggest, setShowLinkSuggest] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [encryptPassword, setEncryptPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showDate, setShowDate] = useState(false);
  // 保存勾非常驻：编辑模式下用户点击屏幕后才从三点滑出
  const [hasInteracted, setHasInteracted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  // 顶部工具栏毛玻璃：默认透明（true），滚动时显示（false），与主页同逻辑
  const [toolbarHidden, setToolbarHidden] = useState(true);
  const lastScrollYRef = useRef(0);
  // 编辑前的快照，用于取消编辑时恢复
  const originalNoteRef = useRef<Note | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 进入编辑模式后聚焦内容输入区（光标定位到末尾，便于继续书写）
  useEffect(() => {
    if (isEditing && bodyRef.current) {
      bodyRef.current.focus();
      const len = bodyRef.current.value.length;
      bodyRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const applyTemplate = (content: string, title: string) => {
    if (!note) return;
    setNote({ ...note, content, title: title || note.title });
    setShowTemplatePicker(false);
  };

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
              const loaded = { ...n, content: decrypted, plainText: '' };
              setNote(loaded);
              originalNoteRef.current = loaded;
            } else {
              setNote(n);
              originalNoteRef.current = n;
            }
          } catch {
            setNote(n);
            originalNoteRef.current = n;
          }
        } else {
          setNote(n);
          originalNoteRef.current = n;
        }
        // 已有笔记默认阅读模式
        setIsEditing(false);
      });
    } else {
      // 新建笔记自动进入编辑模式
      // 智能保存位置：从文件夹进入 → 保存到该文件夹；从置顶笔记进入 → 自动置顶
      const now = Date.now();
      const inheritFolderId = selectedFolderId || null;
      const inheritIsPinned = showFavorites || false;
      const newNote: Note = {
        id: `note-${now}`,
        title: '',
        content: '',
        plainText: '',
        folderId: inheritFolderId,
        tagIds: [],
        isPinned: inheritIsPinned,
        isLocked: false,
        isArchived: false,
        isEncrypted: false,
        attachments: [],
        createdAt: now,
        updatedAt: now,
        syncStatus: 'local',
      };
      setNote(newNote);
      originalNoteRef.current = newNote;
      // 新建笔记直接进入编辑模式，✓保存按钮常驻
      setIsEditing(true);
      setHasInteracted(true);
    }
  }, [selectedNoteId, selectedFolderId, showFavorites, showAllNotes]);

  // 手动保存
  const handleSave = async () => {
    if (!note) return;
    setIsSaving(true);
    try {
      const n = { ...note };
      // 标题始终从内容首行提取（编辑区无独立标题字段，首行即标题）
      const firstLine = n.content.split('\n').find(l => l.trim()) || '';
      n.title = firstLine.replace(/[#*`>\-|_\[\]()]/g, '').trim().slice(0, 100);
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

      await db.notes.put(n);

      if (n.isEncrypted) {
        n.content = note.content;
        n.plainText = note.plainText;
      }
      setNote(n);
      originalNoteRef.current = n;
      // 记录到最近访问
      const title = n.title || n.content.slice(0, 20) || '新建笔记';
      addRecentItem(n.id, title, 'note');
      setIsEditing(false);
      setHasInteracted(false);
      setPreviewMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  // 进入编辑模式
  const handleStartEdit = () => {
    if (!note) return;
    originalNoteRef.current = { ...note };
    setIsEditing(true);
    setHasInteracted(true);
    setPreviewMode(false);
  };

  // 修改 note 字段（仅编辑模式下使用）
  const handleChange = (field: keyof Note, value: string | boolean | string[] | null | Attachment[]) => {
    if (!note) return;
    const updated = { ...note, [field]: value };
    const error = validateNote(updated);
    if (error) {
      console.warn('数据验证失败:', error);
      return;
    }
    setNote(updated);
  };

  const handleContentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    const beforeCursor = value.slice(0, cursorPos);
    const linkMatch = beforeCursor.match(/\[\[([^\]]*)$/);
    if (linkMatch) {
      setLinkQuery(linkMatch[1]);
      setShowLinkSuggest(true);
      getLinkSuggestions(linkMatch[1], note?.id).then(setLinkSuggestions);
    } else {
      setShowLinkSuggest(false);
    }
    handleChange('content', value);
  };

  // 键盘快捷键: Esc 退出编辑、Cmd/Ctrl+Enter 保存、Cmd/Ctrl+B 加粗、Cmd/Ctrl+I 斜体
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      handleBack();
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        wrapSelection('**');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        wrapSelection('*');
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        insertWikilink();
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        insertCodeBlock();
        return;
      }
    }
  };

  // 图片粘贴：自动转 data URL 写入内容，并保存附件元数据
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file || !note) continue;
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('读取失败'));
            reader.readAsDataURL(file);
          });
          const attachmentId = `att-${Date.now()}-${i}`;
          const newAttachment: Attachment = {
            id: attachmentId,
            noteId: note.id,
            type: 'image',
            filename: `粘贴图片-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
            mimeType: file.type,
            size: file.size,
            url: dataUrl,
          };
          const textarea = bodyRef.current;
          const start = textarea?.selectionStart ?? note.content.length;
          const end = textarea?.selectionEnd ?? start;
          const markdown = `\n![${newAttachment.filename}](attachment:${attachmentId})\n`;
          const newContent = note.content.slice(0, start) + markdown + note.content.slice(end);
          setNote({
            ...note,
            content: newContent,
            attachments: [...(note.attachments || []), newAttachment],
          });
        } catch (err) {
          console.error('图片粘贴失败:', err);
        }
        return;
      }
    }
  };

  const [linkQuery, setLinkQuery] = useState('');

  const insertLink = (targetTitle: string) => {
    if (!note) return;
    const textarea = bodyRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const before = note.content.slice(0, cursorPos);
    const after = note.content.slice(cursorPos);
    const newBefore = before.replace(/\[\[([^\]]*)$/, `[[${targetTitle}]]`);
    const newContent = newBefore + after;
    handleChange('content', newContent);
    setShowLinkSuggest(false);
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
      if (noteId) setSelectedNoteId(noteId);
    }
  };

  // ── Markdown 格式化工具 ──────────────────────────
  const wrapSelection = (before: string, after: string = before) => {
    const textarea = bodyRef.current;
    if (!textarea || !note) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = note.content.slice(start, end);
    const newContent = note.content.slice(0, start) + before + selected + after + note.content.slice(end);
    handleChange('content', newContent);
    setTimeout(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      } else {
        const pos = start + before.length;
        textarea.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = bodyRef.current;
    if (!textarea || !note) return;
    const start = textarea.selectionStart;
    const before = note.content.slice(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const newContent = note.content.slice(0, lineStart) + prefix + note.content.slice(lineStart);
    handleChange('content', newContent);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + prefix.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const insertCodeBlock = () => {
    const textarea = bodyRef.current;
    if (!textarea || !note) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = note.content.slice(start, end);
    const block = `\n\`\`\`\n${selected || '代码'}\n\`\`\`\n`;
    const newContent = note.content.slice(0, start) + block + note.content.slice(end);
    handleChange('content', newContent);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + block.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const insertWikilink = () => {
    const textarea = bodyRef.current;
    if (!textarea || !note) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = note.content.slice(start, end);
    const insert = selected ? `[[${selected}]]` : '[[]]';
    const newContent = note.content.slice(0, start) + insert + note.content.slice(end);
    handleChange('content', newContent);
    setTimeout(() => {
      textarea.focus();
      const pos = start + (selected ? insert.length : 2);
      textarea.setSelectionRange(pos, pos);
      if (!selected) {
        setShowLinkSuggest(true);
        getLinkSuggestions('', note?.id).then(setLinkSuggestions);
      }
    }, 0);
  };

  // 将 [[标题]] 预处理为标准 Markdown 链接，便于 ReactMarkdown 渲染
  const preprocessContent = (content: string): string => {
    return content.replace(/\[\[([^\]]+)\]\]/g, (_, title) => `[${title}](#wikilink:${encodeURIComponent(title)})`);
  };

  const markdownComponents = {
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith('#wikilink:')) {
        return (
          <a
            href={href}
            className="text-[var(--accent-mint)] underline cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              const title = decodeURIComponent(href.replace('#wikilink:', ''));
              db.notes.filter(n => n.title === title && !n.isArchived).first().then(n => {
                if (n) setSelectedNoteId(n.id);
              });
            }}
          >
            {children}
          </a>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-mint)] underline">{children}</a>;
    },
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      if (src?.startsWith('attachment:')) {
        const attachmentId = src.replace('attachment:', '');
        const attachment = note?.attachments?.find(a => a.id === attachmentId);
        if (attachment?.url) {
          return <img src={attachment.url} alt={alt || attachment.filename} loading="lazy" className="markdown-image" />;
        }
        return <span className="typo-meta text-[var(--text-secondary)]">[图片已丢失]</span>;
      }
      return <img src={src} alt={alt} loading="lazy" className="markdown-image" />;
    },
  };

  const handleDelete = async () => {
    if (!note) return;
    // 移入回收站（软删除），可在回收站页面恢复或永久删除
    await db.notes.update(note.id, { isArchived: true });
    goBack();
    setSelectedNoteId(null);
  };

  const handleShare = async () => {
    if (!note) return;
    const shareText = note.plainText || note.content || '';
    const shareTitle = note.title || '备忘录';
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText });
      } catch {
        // 用户取消分享
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert('已复制到剪贴板');
      } catch {
        alert('分享功能不可用');
      }
    }
  };

  const handleExport = async () => {
    if (!note) return;
    try {
      await exportNoteAsMarkdown(note);
    } catch (e) {
      console.error('导出失败:', e);
      alert('导出失败');
    }
  };

  const handleLockToggle = async () => {
    if (!note) return;
    if (note.isLocked) {
      // 已锁定 → 解锁：需要密码
      if (hasLockPassword()) {
        setShowPasswordInput(true);
      } else {
        // 无密码设置，直接解锁
        handleChange('isLocked', false);
      }
    } else {
      // 未锁定 → 锁定：需要先设置密码
      if (!hasLockPassword()) {
        const pwd = prompt('设置锁定密码：');
        if (!pwd) return;
        await unlockWithPassword(pwd);
      }
      handleChange('isLocked', true);
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
    } catch {
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
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    // 玻璃背景：顶部透明，滚动时显示毛玻璃（与主页 Logo 同逻辑，无 border-bottom）
    setToolbarHidden(y < 10);
    lastScrollYRef.current = y;
    setShowDate(y < 10);
  };

  // 返回时如果有未保存的编辑，自动保存
  const handleBack = () => {
    if (note && originalNoteRef.current) {
      const orig = originalNoteRef.current;
      // 比较所有可能修改的字段：标题、内容、标签、文件夹、置顶、锁定
      const hasChanges = note.title !== orig.title
                      || note.content !== orig.content
                      || JSON.stringify(note.tagIds) !== JSON.stringify(orig.tagIds)
                      || note.folderId !== orig.folderId
                      || note.isPinned !== orig.isPinned
                      || note.isLocked !== orig.isLocked;
      if (hasChanges) {
        handleSave();
      } else {
        setIsEditing(false);
        setHasInteracted(false);
      }
    }
    goBack();
    setSelectedNoteId(null);
  };

  if (!note) return <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">加载中...</div>;

  const noteTags = tags?.filter(t => note.tagIds.includes(t.id)) || [];
  const currentFolder = folders?.find(f => f.id === note.folderId);
  const isLocked = note.isLocked && note.isEncrypted;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 — fixed 覆盖在内容上方，滚动时显示毛玻璃浮层（与主页 Logo 同逻辑），默认透明无背景无线 */}
      <div className="shrink-0">
      <motion.div
        animate={{
          backgroundColor: toolbarHidden ? 'rgba(0,0,0,0)' : (resolvedTheme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(20,20,22,0.68)'),
        }}
        transition={{ duration: 0.25 }}
        style={{
          backdropFilter: toolbarHidden ? 'none' : 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: toolbarHidden ? 'none' : 'blur(32px) saturate(180%)',
        }}
        className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 fixed top-0 left-0 right-0 md:left-[240px] z-30"
      >
        {/* 返回 — ios-glass-btn 质感，与汉堡菜单/搜索栏一致 */}
        <button onClick={handleBack} className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>

        {/* 桌面端按钮组 — 仅阅读模式显示 */}
        {!isEditing && (
          <>
            <div className="w-px h-6 bg-[var(--glass-border)] mx-0.5 hidden sm:block" />
            <button onClick={() => handleChange('isPinned', !note.isPinned)} className={`icon-press hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-colors shrink-0 ${note.isPinned ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              <Pin size={18} className={note.isPinned ? 'fill-current' : ''} />
            </button>
            <button onClick={handleExport} className="icon-press hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors shrink-0" title="导出为 Markdown">
              <Download size={18} />
            </button>
            <button onClick={handleLockToggle} className={`icon-press hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-colors shrink-0 ${note.isLocked ? 'text-[var(--accent-ocean)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              {note.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
            <div className="relative hidden sm:block">
              <button onClick={() => setShowFolderPicker(!showFolderPicker)} className="icon-press glass px-3 h-9 rounded-xl flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <FolderIcon size={15} />
                {currentFolder ? currentFolder.name : '文件夹'}
              </button>
              {showFolderPicker && (
                <div className="absolute top-11 left-0 glass-strong rounded-xl p-2 min-w-[160px] z-50">
                  <button onClick={() => { handleChange('folderId', null); setShowFolderPicker(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-[var(--text-secondary)]">无</button>
                  {folders?.map(f => {
                    const FIcon = getFolderIcon(f.icon);
                    return (
                    <button key={f.id} onClick={() => { handleChange('folderId', f.id); setShowFolderPicker(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 flex items-center gap-2 text-[var(--text-primary)]">
                      <FIcon size={15} /> {f.name}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative hidden sm:block">
              <button onClick={() => setShowTagPicker(!showTagPicker)} className="icon-press glass px-3 h-9 rounded-xl flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
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
          </>
        )}

        <div className="flex-1" />

        {/* 桌面端右侧按钮 — 仅阅读模式 */}
        {!isEditing && (
          <>
            <button onClick={() => { setShowAIPanel(!showAIPanel); setShowHistory(false); setShowBacklinks(false); }} className={`icon-press hidden sm:flex glass px-3 h-9 rounded-xl items-center gap-2 text-sm transition-colors shrink-0 ${showAIPanel ? 'text-[var(--accent-violet)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              <Sparkles size={15} /> AI
            </button>
            <button onClick={() => { setShowHistory(!showHistory); setShowAIPanel(false); setShowBacklinks(false); }} className={`icon-press hidden sm:flex glass px-3 h-9 rounded-xl items-center gap-2 text-sm transition-colors shrink-0 ${showHistory ? 'text-[var(--accent-mint)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              <History size={15} /> 历史
            </button>
            <button onClick={() => { setShowBacklinks(!showBacklinks); setShowAIPanel(false); setShowHistory(false); }} className={`icon-press hidden sm:flex glass px-3 h-9 rounded-xl items-center gap-2 text-sm transition-colors shrink-0 ${showBacklinks ? 'text-[var(--accent-ocean)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`} title="反向链接">
              <Link2 size={15} /> 链接
            </button>
            <button onClick={handleDelete} title="移到回收站" className="icon-press hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0">
              <Trash2 size={18} />
            </button>
          </>
        )}

        {/* 移动端「更多」菜单 — 位置在保存路径左边 */}
        <div className="relative sm:hidden">
          <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] shrink-0">
            <MoreHorizontal size={18} />
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute top-11 right-0 glass-strong rounded-xl p-2 min-w-[180px] z-50 space-y-0.5 max-h-[calc(100vh-100px)] overflow-y-auto overscroll-contain">
                {/* 分享 / 导出 */}
                <button onClick={() => { handleShare(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <Share2 size={16} /> 分享
                </button>
                <button onClick={() => { handleExport(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <Download size={16} /> 导出 Markdown
                </button>
                {/* 快速状态：置顶 / 锁定 */}
                <button onClick={() => { handleChange('isPinned', !note.isPinned); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <Pin size={16} className={note.isPinned ? 'text-[var(--accent-mint)] fill-current' : ''} /> {note.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button onClick={() => { handleLockToggle(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  {note.isLocked ? <Lock size={16} className="text-[var(--accent-ocean)]" /> : <Unlock size={16} />} {note.isLocked ? '解锁' : '锁定'}
                </button>

                {/* 整理 */}
                <div className="h-px bg-[var(--glass-border)] my-1" />
                <button onClick={() => { setShowSaveLocation(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <FolderInput size={16} /> 移动 <span className="typo-meta ml-auto">{currentFolder ? currentFolder.name : '本地'}</span>
                </button>
                <button onClick={() => { setShowTagPicker(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <TagIcon size={16} /> 标签 {noteTags.length > 0 && <span className="typo-meta ml-auto">{noteTags.length}</span>}
                </button>

                {/* 工具 */}
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
                <button onClick={() => { setShowTemplatePicker(true); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)]">
                  <FileText size={16} /> 选择模板
                </button>

                {/* 危险操作 */}
                <div className="h-px bg-[var(--glass-border)] my-1" />
                <button onClick={() => { handleDelete(); setShowMoreMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 text-red-400">
                  <Trash2 size={16} /> 移到回收站
                </button>
              </div>
            </>
          )}
        </div>

        {/* 编辑/预览切换 - 仅编辑模式显示 */}
        {isEditing && (
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            style={{ color: previewMode ? 'var(--accent-mint)' : 'var(--text-secondary)' }}
            title={previewMode ? '编辑' : '预览'}
          >
            {previewMode ? <Edit3 size={18} /> : <Eye size={18} />}
          </button>
        )}

        {/* 右上角：编辑按钮（常驻）/ ✓保存按钮（点击屏幕后从三点滑出） */}
        <AnimatePresence mode="wait">
          {isEditing ? (
            hasInteracted && (
              <motion.button
                key="save"
                initial={{ opacity: 0, scale: 0.5, x: -44 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, x: -44 }}
                transition={{ type: 'spring', stiffness: 480, damping: 30 }}
                whileTap={{ scale: 0.85 }}
                onClick={handleSave}
                disabled={isSaving}
                className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
                style={{ color: 'var(--accent-mint)' }}
                title="保存"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={20} strokeWidth={3} />}
              </motion.button>
            )
          ) : (
            <motion.button
              key="edit"
              initial={{ opacity: 0, scale: 0.5, x: -44 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: -44 }}
              transition={{ type: 'spring', stiffness: 480, damping: 30 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleStartEdit}
              className="ios-glass-btn w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ color: 'var(--accent-mint)' }}
              title="编辑"
            >
              <Edit3 size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      </div>

      {/* 移动到文件夹 — 底部 Action Sheet，z-50 高于工具栏 */}
      {showSaveLocation && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowSaveLocation(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 ios-glass rounded-t-2xl p-4 pb-8 max-h-[60vh] overflow-y-auto">
            <div className="w-10 h-1 bg-[var(--text-secondary)] rounded-full mx-auto mb-3 opacity-30" />
            <div className="flex items-center gap-2 mb-3">
              <FolderInput size={16} className="text-[var(--accent-mint)]" />
              <span className="typo-label">移动到文件夹</span>
              <button onClick={() => setShowSaveLocation(false)} className="ml-auto typo-meta text-[var(--accent-mint)]">完成</button>
            </div>
            <div className="space-y-1">
              <button onClick={() => { handleChange('folderId', null); setShowSaveLocation(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${!note.folderId ? 'text-[var(--accent-mint)] bg-[var(--accent-mint)]/10' : 'text-[var(--text-primary)] hover:bg-white/5'}`}>
                <FolderIcon size={18} /> 本地 {!note.folderId && <Check size={16} className="ml-auto" />}
              </button>
              {(folders?.filter(f => !f.id.startsWith('folder-cloud-')) || []).length > 0 && (
                <p className="typo-meta px-4 pt-2 pb-1">本地文件夹</p>
              )}
              {folders?.filter(f => !f.id.startsWith('folder-cloud-')).map(f => {
                const FIcon = getFolderIcon(f.icon);
                return (
                <button key={f.id} onClick={() => { handleChange('folderId', f.id); setShowSaveLocation(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${note.folderId === f.id ? 'text-[var(--accent-mint)] bg-[var(--accent-mint)]/10' : 'text-[var(--text-primary)] hover:bg-white/5'}`}>
                  <FIcon size={18} /> {f.name} {note.folderId === f.id && <Check size={16} className="ml-auto" />}
                </button>
                );
              })}
              {(folders?.filter(f => f.id.startsWith('folder-cloud-')) || []).length > 0 && (
                <p className="typo-meta px-4 pt-2 pb-1">网盘文件夹</p>
              )}
              {folders?.filter(f => f.id.startsWith('folder-cloud-')).map(f => (
                <button key={f.id} onClick={() => { handleChange('folderId', f.id); setShowSaveLocation(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${note.folderId === f.id ? 'text-[var(--accent-mint)] bg-[var(--accent-mint)]/10' : 'text-[var(--text-primary)] hover:bg-white/5'}`}>
                  <Cloud size={18} /> {f.name} {note.folderId === f.id && <Check size={16} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 标签选择器 — 底部 Action Sheet，苹果备忘录风格，支持新建标签 */}
      {showTagPicker && note && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowTagPicker(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 ios-glass rounded-t-[28px] p-5 pb-8 max-h-[70vh] overflow-y-auto">
            <div className="w-10 h-1 bg-[var(--text-secondary)] rounded-full mx-auto mb-4 opacity-30" />
            <div className="flex items-center gap-2 mb-4">
              <TagIcon size={18} className="text-[var(--accent-mint)]" />
              <span className="typo-note-title">标签</span>
              <button onClick={() => setShowTagPicker(false)} className="ml-auto typo-meta text-[var(--accent-mint)]">完成</button>
            </div>

            {/* 已有标签 — 胶囊按钮 */}
            {tags && tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {tags.map(t => {
                  const selected = note.tagIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => {
                      const newTags = selected ? note.tagIds.filter(id => id !== t.id) : [...note.tagIds, t.id];
                      handleChange('tagIds', newTags);
                    }} className={`icon-press px-3.5 py-2 rounded-full text-sm flex items-center gap-1.5 transition-all ${selected ? 'ios-glass-btn text-[var(--accent-mint)] ring-1 ring-[var(--accent-mint)]' : 'ios-glass-btn text-[var(--text-secondary)]'}`}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                      {t.name}
                      {selected && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 新建标签 — 输入框 + 颜色选择 + 创建按钮 */}
            <div className="ios-pill-note overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '0.5px solid var(--glass-border)' }}>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagName.trim()) {
                      const tagId = `tag-${Date.now()}`;
                      db.tags.add({ id: tagId, name: newTagName.trim(), color: newTagColor, createdAt: Date.now() });
                      handleChange('tagIds', [...note.tagIds, tagId]);
                      setNewTagName('');
                    }
                  }}
                  placeholder="新建标签..."
                  className="flex-1 bg-transparent border-0 outline-none text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] typo-body"
                />
                <button
                  onClick={() => {
                    if (!newTagName.trim()) return;
                    const tagId = `tag-${Date.now()}`;
                    db.tags.add({ id: tagId, name: newTagName.trim(), color: newTagColor, createdAt: Date.now() });
                    handleChange('tagIds', [...note.tagIds, tagId]);
                    setNewTagName('');
                  }}
                  disabled={!newTagName.trim()}
                  className="icon-press btn-primary text-xs px-3 py-1.5 rounded-full disabled:opacity-40"
                >
                  添加
                </button>
              </div>
              {/* 颜色选择 */}
              <div className="flex items-center gap-2.5 px-4 py-3 overflow-x-auto">
                {['#2dd4bf', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#34d399', '#f472b6', '#60a5fa'].map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`icon-press w-7 h-7 rounded-full shrink-0 transition-all ${newTagColor === color ? 'ring-2 ring-offset-2 ring-offset-transparent ring-white/50' : ''}`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 模板选择器 */}
      {showTemplatePicker && note && (
        <TemplatePicker onSelect={applyTemplate} onClose={() => setShowTemplatePicker(false)} />
      )}

      {/* 密码输入 */}
      {showPasswordInput && (
        <div className="px-3 sm:px-6 py-3 glass border-b border-[var(--glass-border)]">
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
            <input type="password" value={encryptPassword} onChange={(e) => setEncryptPassword(e.target.value)} placeholder="输入锁定密码..." className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-[var(--glass-border)] text-sm" onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} />
            <button onClick={handleUnlock} disabled={decrypting} className="glass px-4 py-2 rounded-xl text-sm text-[var(--accent-mint)] hover:bg-white/10">
              {decrypting ? '解密中...' : '解锁'}
            </button>
            <button onClick={() => { setShowPasswordInput(false); setEncryptPassword(''); }} className="typo-body">取消</button>
          </div>
        </div>
      )}

      {/* 内容区 — 阅读模式 vs 编辑模式，顶部留出 fixed 工具栏空间 */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-6 pt-16 pb-6">
        <div className="max-w-3xl mx-auto w-full">
          {/* 日期 — 仅滚动到顶部时显示 */}
          <motion.div animate={{ opacity: showDate ? 1 : 0, height: showDate ? 'auto' : 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mb-3">
            <span className="typo-meta">{new Date(note.updatedAt).toLocaleString('zh-CN')}</span>
          </motion.div>

          {/* AI 面板 */}
          {showAIPanel && selectedNoteId && note && (
            <div className="mb-4">
              <AIPanel note={note} onApplyTags={(tagIds) => { const updated = { ...note, tagIds: [...new Set([...note.tagIds, ...tagIds])] }; setNote(updated); }} onClose={() => setShowAIPanel(false)} />
            </div>
          )}

          {/* 版本历史面板 */}
          {showHistory && selectedNoteId && (
            <div className="mb-4">
              <VersionHistory noteId={selectedNoteId} onClose={() => setShowHistory(false)} onRollback={handleRollback} />
            </div>
          )}

          {/* 反向链接面板 */}
          {showBacklinks && selectedNoteId && (
            <div className="mb-4">
              <BacklinksPanel noteId={selectedNoteId} onNoteClick={(id) => { setSelectedNoteId(id); setShowBacklinks(false); }} />
            </div>
          )}

          {isLocked && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--accent-ocean)]/10 border border-[var(--accent-ocean)]/20 text-sm text-[var(--accent-ocean)]">
              此笔记已加密，锁定状态下内容不可见。
            </div>
          )}

          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="relative">
                {showLinkSuggest && linkSuggestions.length > 0 && (
                  <div className="absolute z-50 glass-strong rounded-xl p-2 max-w-md max-h-48 overflow-y-auto" style={{ bottom: '100%', marginBottom: '4px' }}>
                    <p className="typo-meta px-2 py-1">链接到笔记</p>
                    {linkSuggestions.map((n) => (
                      <button key={n.id} onClick={() => insertLink(n.title)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-[var(--text-primary)] flex items-center gap-2">
                        <Link2 size={12} className="text-[var(--accent-ocean)]" />
                        <span className="truncate">{n.title || '无标题'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {previewMode ? (
                  /* 编辑模式下的预览 */
                  <div className="markdown-body" style={{ fontSize: 'var(--font-size-base, 16px)', minHeight: '300px' }}>
                    {note.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                        {preprocessContent(note.content)}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-[var(--text-secondary)]">暂无内容可预览</p>
                    )}
                  </div>
                ) : (
                  /* 编辑模式 - textarea + 格式工具栏 */
                  <>
                    {/* Markdown 格式工具栏 */}
                    <div className="flex items-center gap-0.5 mb-3 glass rounded-xl p-1 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                      {([
                        { icon: Bold, action: () => wrapSelection('**'), title: '加粗' },
                        { icon: Italic, action: () => wrapSelection('*'), title: '斜体' },
                        { icon: Heading1, action: () => insertLinePrefix('# '), title: '标题' },
                        { icon: List, action: () => insertLinePrefix('- '), title: '列表' },
                        { icon: Code2, action: insertCodeBlock, title: '代码块' },
                        { icon: Quote, action: () => insertLinePrefix('> '), title: '引用' },
                        { icon: Link2, action: insertWikilink, title: '笔记链接' },
                      ] as const).map(({ icon: Icon, action, title }) => (
                        <button
                          key={title}
                          onClick={action}
                          className="icon-press w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[var(--text-secondary)] hover:text-[var(--accent-mint)] hover:bg-white/5 transition-colors"
                          title={title}
                        >
                          <Icon size={15} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      ref={bodyRef}
                      value={note.content}
                      onChange={handleContentInput}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className="w-full min-h-[500px] bg-transparent resize-none outline-none text-[var(--text-primary)] leading-relaxed"
                      style={{ fontSize: 'var(--font-size-base, 16px)' }}
                      disabled={isLocked}
                      placeholder="开始记录… 支持 Markdown 语法  ·  ⌘/Ctrl+B 加粗 · ⌘/Ctrl+I 斜体 · ⌘/Ctrl+K 笔记链接 · ⌘/Ctrl+E 代码块 · ⌘/Ctrl+Enter 保存  ·  可直接粘贴图片"
                    />
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div key="read" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-[var(--text-primary)] leading-relaxed" onPointerDown={(e) => { const t = e.target as HTMLElement; if (t.tagName === 'A' || t.closest('a')) return; if (!isEditing && note) { originalNoteRef.current = { ...note }; setIsEditing(true); setHasInteracted(true); } }} id="markdown-preview">
                {note.title && (
                  <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '0.5rem' }}>{note.title}</h1>
                )}
                {note.content && (() => {
                  let display = note.content;
                  if (note.title && note.content.startsWith(note.title)) {
                    display = note.content.slice(note.title.length).replace(/^\n/, '');
                  }
                  return display ? (
                    <div className="markdown-body" style={{ fontSize: 'var(--font-size-base, 16px)' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                        {preprocessContent(display)}
                      </ReactMarkdown>
                    </div>
                  ) : null;
                })()}
                {!note.title && !note.content && (
                  <div className="text-center py-20 text-[var(--text-secondary)]">
                    <Edit3 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="typo-body">点击屏幕开始记录</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 已添加标签展示 — 编辑器和阅读模式都显示 */}
          {noteTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '0.5px solid var(--glass-border)' }}>
              {noteTags.map(t => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                  style={{ background: `${t.color}20`, color: t.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
