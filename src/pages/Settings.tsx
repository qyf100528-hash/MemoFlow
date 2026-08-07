import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Grid, List, Kanban, Clock, Save, Type, Eye, SpellCheck, Database, Info, Palette, Check, Sparkles, CheckCircle2, Brain, FileText, Plus, Trash2, Monitor } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../lib/db';
import { createTemplate, deleteTemplate } from '../lib/templates';
import type { NoteTemplate } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { hasApiKey } from '../lib/ai/deepseek';
import type { AccentColor } from '../types';

// 5 种重点色 — 与 App.tsx 中 ACCENT_PRESETS 保持一致
const ACCENT_COLORS: { id: AccentColor; label: string; primary: string; secondary: string }[] = [
  { id: 'mint',   label: '薄荷',  primary: '#2dd4bf', secondary: '#38bdf8' },
  { id: 'ocean',  label: '海洋',  primary: '#38bdf8', secondary: '#818cf8' },
  { id: 'sunset', label: '日落',  primary: '#fb923c', secondary: '#f43f5e' },
  { id: 'rose',   label: '玫瑰',  primary: '#f472b6', secondary: '#c084fc' },
  { id: 'violet', label: '紫罗',  primary: '#a78bfa', secondary: '#22d3ee' },
];

// 背景色 — 与重点色相同的 5 个选项，可自由搭配组合
const BG_COLORS: { id: AccentColor; label: string; primary: string; secondary: string }[] = [
  { id: 'mint',   label: '薄荷',  primary: '#2dd4bf', secondary: '#38bdf8' },
  { id: 'ocean',  label: '海洋',  primary: '#38bdf8', secondary: '#818cf8' },
  { id: 'sunset', label: '日落',  primary: '#fb923c', secondary: '#f43f5e' },
  { id: 'rose',   label: '玫瑰',  primary: '#f472b6', secondary: '#c084fc' },
  { id: 'violet', label: '紫罗',  primary: '#a78bfa', secondary: '#22d3ee' },
];

export function Settings() {
  const { settings, setTheme, setViewMode, updateSettings } = useStore();
  const noteCount = useLiveQuery(() => db.notes.count(), []);
  const folderCount = useLiveQuery(() => db.folders.count(), []);
  const tagCount = useLiveQuery(() => db.tags.count(), []);
  const [showApiKey, setShowApiKey] = useState(false);
  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').toArray(), []);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplIcon, setNewTplIcon] = useState('📝');
  const [newTplContent, setNewTplContent] = useState('');

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ paddingBottom: '100px' }}>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-1 sm:mb-2">设置</h1>
        <p className="text-sm text-[var(--text-secondary)]">个性化你的 MemoFlow 体验</p>
      </div>

      <div className="max-w-2xl space-y-4 sm:space-y-6">
        {/* 外观 */}
        <section className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Eye size={18} className="text-[var(--accent-mint)]" /> 外观
          </h2>

          <div className="space-y-4">
            {/* 主题 — 三档分段控制器：自动/深色/浅色 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">主题模式</label>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">自动跟随系统，或手动选择</p>
              </div>
              <div className="ios-segment flex p-1 gap-0.5 shrink-0">
                {([
                  { mode: 'auto' as const, icon: Monitor, label: '自动' },
                  { mode: 'dark' as const, icon: Moon, label: '深色' },
                  { mode: 'light' as const, icon: Sun, label: '浅色' },
                ]).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setTheme(mode)}
                    className={`ios-segment-btn px-3 py-1.5 rounded-[13px] text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
                      settings.theme === mode
                        ? 'active text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 重点色 — 5 种自定义配色 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <Palette size={14} /> 重点色
                  </label>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">选择应用的主色调</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {ACCENT_COLORS.map((c) => {
                  const active = settings.accentColor === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => updateSettings({ accentColor: c.id })}
                      className="relative rounded-xl p-2 sm:p-3 transition-all group"
                      style={{
                        background: active ? `${c.primary}20` : 'transparent',
                        border: `1px solid ${active ? c.primary : 'var(--glass-border)'}`,
                      }}
                    >
                      {/* 色块 */}
                      <div
                        className="w-full aspect-square rounded-lg mb-1.5 sm:mb-2 relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}
                      >
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center"
                            >
                              <Check size={14} className="text-white" strokeWidth={3} />
                            </motion.div>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-center" style={{ color: active ? c.primary : 'var(--text-secondary)' }}>
                        {c.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 背景色 — 与重点色相同的 5 个选项，可自由搭配 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <Palette size={14} /> 背景色
                  </label>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">选择应用的背景色调，可与重点色自由搭配</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {BG_COLORS.map((bg) => {
                  const active = settings.backgroundColor === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => updateSettings({ backgroundColor: bg.id })}
                      className="relative rounded-xl p-2 sm:p-3 transition-all group"
                      style={{
                        background: active ? `${bg.primary}20` : 'transparent',
                        border: `1px solid ${active ? bg.primary : 'var(--glass-border)'}`,
                      }}
                    >
                      <div
                        className="w-full aspect-square rounded-lg mb-1.5 sm:mb-2 relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${bg.primary}, ${bg.secondary})` }}
                      >
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center"
                            >
                              <Check size={14} className="text-white" strokeWidth={3} />
                            </motion.div>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-center" style={{ color: active ? bg.primary : 'var(--text-secondary)' }}>
                        {bg.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 视图模式 — iOS 分段控制器风格，所有按钮同行等高 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">默认视图</label>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">笔记列表的显示方式</p>
              </div>
              <div className="ios-segment flex p-1 gap-0.5 shrink-0">
                {([
                  { mode: 'list' as const, icon: List, label: '列表' },
                  { mode: 'grid' as const, icon: Grid, label: '网格' },
                  { mode: 'kanban' as const, icon: Kanban, label: '看板' },
                  { mode: 'timeline' as const, icon: Clock, label: '时间线' },
                ]).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`ios-segment-btn px-3 py-1.5 rounded-[13px] text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
                      settings.viewMode === mode
                        ? 'active text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 字体大小 — iOS 分段控制器风格 */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <Type size={14} /> 字体大小
                </label>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">影响笔记正文显示大小</p>
              </div>
              <div className="ios-segment flex p-1 gap-0.5 shrink-0">
                {([
                  { size: 'small' as const, label: '小', preview: 'A' },
                  { size: 'medium' as const, label: '中', preview: 'A' },
                  { size: 'large' as const, label: '大', preview: 'A' },
                ]).map(({ size, label, preview }, idx) => (
                  <button
                    key={size}
                    onClick={() => updateSettings({ fontSize: size })}
                    className={`ios-segment-btn px-3.5 py-1.5 rounded-[13px] text-xs font-medium flex items-center gap-1 transition-all ${
                      settings.fontSize === size
                        ? 'active text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                    style={{ fontSize: idx === 0 ? '11px' : idx === 1 ? '13px' : '15px' }}
                  >
                    <span style={{ fontSize: idx === 0 ? '12px' : idx === 1 ? '14px' : '16px' }}>{preview}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 编辑器 */}
        <section className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Save size={18} className="text-[var(--accent-mint)]" /> 编辑器
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="自动保存"
              desc="编辑后自动保存笔记"
              value={settings.autoSave}
              onChange={(v) => updateSettings({ autoSave: v })}
            />
            <ToggleRow
              label="默认 Markdown 模式"
              desc="新建笔记默认使用 Markdown 格式"
              value={settings.markdownDefault}
              onChange={(v) => updateSettings({ markdownDefault: v })}
            />
            <ToggleRow
              label="显示行号"
              desc="在代码块中显示行号"
              value={settings.showLineNumbers}
              onChange={(v) => updateSettings({ showLineNumbers: v })}
            />
            <ToggleRow
              label="拼写检查"
              desc="编辑时检查拼写"
              value={settings.spellCheck}
              onChange={(v) => updateSettings({ spellCheck: v })}
            />
          </div>
        </section>

        {/* AI 设置 */}
        <section className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--accent-violet)]" /> AI 设置
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <label className="text-sm font-medium text-[var(--text-primary)]">DeepSeek API 密钥</label>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">用于语义标签、智能摘要和语义搜索</p>
                </div>
                {hasApiKey() && (
                  <span className="flex items-center gap-1 text-xs text-[var(--accent-mint)] bg-[var(--accent-mint)]/10 px-2 py-1 rounded-full shrink-0">
                    <CheckCircle2 size={10} />
                    已配置
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.deepseekApiKey}
                  onChange={(e) => updateSettings({ deepseekApiKey: e.target.value })}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl glass text-sm font-mono"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="glass px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-white/10 shrink-0"
                >
                  {showApiKey ? '隐藏' : '显示'}
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-2 leading-relaxed">
                密钥仅存储在本地浏览器中，不会上传到任何服务器。可在 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-mint)] underline">DeepSeek 平台</a> 获取。
              </p>
            </div>
            <div className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Brain size={12} />
                功能说明
              </div>
              <ul className="text-xs text-[var(--text-primary)] space-y-1 ml-4 list-disc">
                <li>自动标签：基于语义分析推荐最匹配的标签</li>
                <li>内容摘要：智能提取核心观点，生成自然语言摘要</li>
                <li>知识库搜索：理解搜索意图，语义级排序搜索结果</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 笔记模板 */}
        <section className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <FileText size={18} className="text-[var(--accent-mint)]" /> 笔记模板
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-3 sm:mb-4">新建笔记时可选模板快速开始</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {templates?.map((tpl: NoteTemplate) => (
              <div key={tpl.id} className="glass rounded-xl p-3 relative group">
                <div className="text-2xl mb-1">{tpl.icon}</div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{tpl.name}</div>
                <div className="text-xs text-[var(--text-secondary)] line-clamp-1">{tpl.description}</div>
                {tpl.isBuiltIn ? (
                  <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded glass text-[var(--text-secondary)]">内置</span>
                ) : (
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {showNewTemplate ? (
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newTplIcon}
                  onChange={(e) => setNewTplIcon(e.target.value)}
                  className="w-12 text-center glass px-2 py-2 rounded-lg text-lg shrink-0"
                  maxLength={2}
                />
                <input
                  type="text"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="模板名称"
                  className="flex-1 min-w-0 glass px-3 py-2 rounded-lg text-sm"
                />
              </div>
              <textarea
                value={newTplContent}
                onChange={(e) => setNewTplContent(e.target.value)}
                placeholder="模板内容（支持 Markdown，可用 {{date}} {{time}} 变量）"
                className="w-full glass px-3 py-2 rounded-lg text-sm min-h-[120px] resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!newTplName.trim() || !newTplContent.trim()) return;
                    await createTemplate({
                      name: newTplName,
                      icon: newTplIcon || '📝',
                      description: '自定义模板',
                      content: newTplContent,
                      category: 'custom',
                    });
                    setNewTplName(''); setNewTplIcon('📝'); setNewTplContent('');
                    setShowNewTemplate(false);
                  }}
                  className="btn-primary text-sm px-4 py-2 flex-1 sm:flex-none"
                >
                  保存模板
                </button>
                <button onClick={() => setShowNewTemplate(false)} className="px-4 py-2 rounded-xl text-sm glass text-[var(--text-secondary)]">
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewTemplate(true)}
              className="w-full py-2.5 rounded-xl glass border-dashed border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-mint)] transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> 新建自定义模板
            </button>
          )}
        </section>

        {/* 数据统计 */}
        <section className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Database size={18} className="text-[var(--accent-mint)]" /> 数据统计
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatBox label="笔记总数" value={noteCount || 0} />
            <StatBox label="文件夹数" value={folderCount || 0} />
            <StatBox label="标签数" value={tagCount || 0} />
          </div>
          <button
            onClick={async () => {
              if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
                await db.notes.clear();
                await db.folders.clear();
                await db.tags.clear();
                await db.cloudAccounts.clear();
                location.reload();
              }
            }}
            className="mt-4 w-full sm:w-auto px-4 py-2 rounded-xl text-sm text-[#ef4444] glass hover:bg-red-500/10 transition-colors"
          >
            清空所有数据
          </button>
        </section>

        {/* 关于 */}
        <section className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Info size={18} className="text-[var(--accent-mint)]" /> 关于
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)] shrink-0">应用名称</span>
              <span className="text-[var(--text-primary)] text-right">MemoFlow</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)] shrink-0">版本</span>
              <span className="text-[var(--text-primary)] text-right">0.1.0 (MVP)</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)] shrink-0">理念</span>
              <span className="gradient-text font-medium text-right">让你的记忆，自由流动</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[var(--accent-mint)]' : 'bg-[var(--glass-border)]'}`}
      >
        <motion.div
          animate={{ x: value ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
        />
      </button>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass p-4 rounded-xl text-center">
      <div className="text-2xl font-bold gradient-text">{value}</div>
      <div className="text-xs text-[var(--text-secondary)] mt-1">{label}</div>
    </div>
  );
}