import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, FileText, FileJson, FileCode, FileType, Apple, Check, AlertCircle, RefreshCw, type LucideIcon } from 'lucide-react';
import { db } from '../lib/db';
import type { ImportSource, ExportFormat, Note, ImportResult } from '../types';

export function Migration() {
  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const importSources: { source: ImportSource; label: string; icon: LucideIcon; color: string; desc: string }[] = [
    { source: 'apple-notes', label: 'Apple Notes', icon: Apple, color: '#a8a8a8', desc: '从 Apple 备忘录导入' },
    { source: 'markdown', label: 'Markdown', icon: FileCode, color: '#2dd4bf', desc: '导入 .md 文件' },
    { source: 'txt', label: 'TXT', icon: FileText, color: '#38bdf8', desc: '导入纯文本文件' },
    { source: 'json', label: 'JSON', icon: FileJson, color: '#fbbf24', desc: '导入 JSON 备份' },
  ];

  const exportFormats: { format: ExportFormat; label: string; icon: LucideIcon; color: string; ext: string }[] = [
    { format: 'markdown', label: 'Markdown', icon: FileCode, color: '#2dd4bf', ext: '.md' },
    { format: 'pdf', label: 'PDF', icon: FileText, color: '#ef4444', ext: '.pdf' },
    { format: 'json', label: 'JSON', icon: FileJson, color: '#fbbf24', ext: '.json' },
    { format: 'word', label: 'Word', icon: FileType, color: '#38bdf8', ext: '.docx' },
  ];

  const handleImport = async (source: ImportSource, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImporting(true);
    setImportResult(null);

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          let note: Note;

          if (source === 'json') {
            const data = JSON.parse(text);
            note = {
              ...data,
              id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: data.createdAt || Date.now(),
              updatedAt: Date.now(),
              syncStatus: 'local',
            };
          } else if (source === 'markdown') {
            const lines = text.split('\n');
            const title = lines[0]?.replace(/^#+\s*/, '') || file.name.replace(/\.md$/, '');
            note = createNote(title, text, 'folder-ideas');
          } else if (source === 'txt') {
            note = createNote(file.name.replace(/\.txt$/, ''), text, 'folder-personal');
          } else {
            note = createNote(file.name, text, 'folder-work');
          }

          await db.notes.add(note);
          imported++;
        } catch (e: unknown) {
          failed++;
          errors.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      setImportResult({ success: imported > 0, imported, failed, errors });
    } catch (e: unknown) {
      setImportResult({ success: false, imported: 0, failed: files.length, errors: [e instanceof Error ? e.message : String(e)] });
    }
    setImporting(false);
  };

  const createNote = (title: string, content: string, folderId: string): Note => ({
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    content,
    plainText: content.replace(/[#*`>\-|_\[\]()]/g, '').slice(0, 500),
    folderId,
    tagIds: [],
    isPinned: false,
    isLocked: false,
    isArchived: false,
    isEncrypted: false,
    attachments: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'local',
  });

  const handleExport = async () => {
    setExporting(true);
    const notesToExport = selectedNotes.length > 0
      ? notes?.filter(n => selectedNotes.includes(n.id)) || []
      : notes || [];

    for (const note of notesToExport) {
      let content = '';
      let mime = 'text/plain';
      let ext = '.txt';

      switch (exportFormat) {
        case 'markdown':
          content = `# ${note.title}\n\n${note.content}`;
          mime = 'text/markdown';
          ext = '.md';
          break;
        case 'json':
          content = JSON.stringify(note, null, 2);
          mime = 'application/json';
          ext = '.json';
          break;
        case 'pdf':
        case 'word':
          content = `${note.title}\n\n${note.content}`;
          mime = 'text/plain';
          ext = exportFormat === 'pdf' ? '.pdf' : '.docx';
          break;
        case 'html':
          content = `<!DOCTYPE html><html><body><h1>${note.title}</h1><div>${note.content}</div></body></html>`;
          mime = 'text/html';
          ext = '.html';
          break;
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title || 'note'}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      await new Promise(r => setTimeout(r, 200));
    }

    setExporting(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      <div className="mb-6 sm:mb-8">
        <h1 className="typo-title mb-1 sm:mb-2">数据迁移</h1>
        <p className="typo-body">自由导入导出你的笔记，数据完全自主</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('import')}
          className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'import' ? 'btn-primary' : 'glass text-[var(--text-secondary)]'}`}
        >
          <Upload size={16} /> 导入
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'export' ? 'btn-primary' : 'glass text-[var(--text-secondary)]'}`}
        >
          <Download size={16} /> 导出
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'import' ? (
          <motion.div key="import" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            {/* 导入源 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
              {importSources.map((src, i) => {
                const Icon = src.icon;
                return (
                  <motion.div
                    key={src.source}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-4 sm:p-5"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${src.color}20` }}>
                        <Icon size={20} style={{ color: src.color }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="typo-section">{src.label}</h3>
                        <p className="typo-meta">{src.desc}</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={fileRef}
                      multiple
                      accept={src.source === 'markdown' ? '.md' : src.source === 'json' ? '.json' : src.source === 'txt' ? '.txt' : '*'}
                      onChange={(e) => handleImport(src.source, e.target.files)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={importing}
                      className="glass w-full py-2 rounded-lg text-sm text-[var(--text-primary)] hover:text-[var(--accent-mint)] transition-colors disabled:opacity-50"
                    >
                      选择文件
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* 导入结果 */}
            <AnimatePresence>
              {importing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card p-4 mb-4 flex items-center gap-3">
                  <RefreshCw size={18} className="animate-spin text-[var(--accent-mint)]" />
                  <span className="typo-body">正在导入...</span>
                </motion.div>
              )}
              {importResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-2">
                    {importResult.success ? (
                      <Check size={20} className="text-[#22c55e]" />
                    ) : (
                      <AlertCircle size={20} className="text-[#ef4444]" />
                    )}
                    <h3 className="font-semibold text-sm sm:text-base">导入结果</h3>
                  </div>
                  <p className="typo-body">
                    成功导入 {importResult.imported} 条, 失败 {importResult.failed} 条
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-[#ef4444] space-y-1">
                      {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="export" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* 导出格式 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {exportFormats.map((fmt, i) => {
                const Icon = fmt.icon;
                const active = exportFormat === fmt.format;
                return (
                  <motion.button
                    key={fmt.format}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setExportFormat(fmt.format)}
                    className={`glass-card p-4 text-center ${active ? 'ring-2 ring-[var(--accent-mint)]' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: `${fmt.color}20` }}>
                      <Icon size={20} style={{ color: fmt.color }} />
                    </div>
                    <h3 className="typo-section">{fmt.label}</h3>
                    <p className="typo-meta mt-0.5">{fmt.ext}</p>
                  </motion.button>
                );
              })}
            </div>

            {/* 笔记选择 */}
            <div className="glass-card p-4 sm:p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm sm:text-base">选择导出的笔记</h3>
                <button
                  onClick={() => setSelectedNotes(selectedNotes.length === notes?.length ? [] : notes?.map(n => n.id) || [])}
                  className="text-sm text-[var(--accent-mint)] shrink-0"
                >
                  {selectedNotes.length === notes?.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {notes?.map(n => (
                  <label key={n.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNotes.includes(n.id) || selectedNotes.length === 0}
                      onChange={() => {
                        if (selectedNotes.includes(n.id)) {
                          setSelectedNotes(selectedNotes.filter(id => id !== n.id));
                        } else {
                          setSelectedNotes([...selectedNotes, n.id]);
                        }
                      }}
                      className="accent-[var(--accent-mint)] shrink-0"
                    />
                    <span className="typo-label truncate">{n.title || '无标题'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 导出按钮 */}
            <button
              onClick={handleExport}
              disabled={exporting || !notes?.length}
              className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exporting ? <><RefreshCw size={16} className="animate-spin" /> 导出中...</> : <><Download size={16} /> 导出 {selectedNotes.length || notes?.length || 0} 条笔记</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
