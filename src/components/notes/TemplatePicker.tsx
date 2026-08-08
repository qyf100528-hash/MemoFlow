import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Calendar, Users, CheckSquare, BookOpen, Rocket, Sparkles, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { fillTemplateVariables } from '../../lib/templates';
import { useStore } from '../../store/useStore';
import type { NoteTemplate } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface Props {
  onSelect: (content: string, title: string) => void;
  onClose: () => void;
}

// 模板分类配置 — lucide 线条图标，与统计卡片/文件夹风格统一
const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  blank:    { label: '空白',   icon: FileText,   color: '#2dd4bf' },
  diary:    { label: '日记',   icon: Calendar,   color: '#fbbf24' },
  meeting:  { label: '会议',   icon: Users,      color: '#38bdf8' },
  todo:     { label: '待办',   icon: CheckSquare,color: '#22c55e' },
  reading:  { label: '阅读',   icon: BookOpen,   color: '#a78bfa' },
  project:  { label: '项目',   icon: Rocket,     color: '#f472b6' },
  custom:   { label: '自定义', icon: Sparkles,   color: '#fb923c' },
};

// 分类显示顺序
const CATEGORY_ORDER = ['blank', 'diary', 'todo', 'meeting', 'reading', 'project', 'custom'];

export function TemplatePicker({ onSelect, onClose }: Props) {
  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').toArray(), []);
  const { selectedFolderId, showFavorites } = useStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredTpl, setHoveredTpl] = useState<string | null>(null);

  // 智能推荐：根据当前上下文推荐模板
  const recommendations = useMemo(() => {
    if (!templates) return [];
    const recs: { tpl: NoteTemplate; reason: string }[] = [];
    // 从置顶笔记进入 → 推荐待办/日记（快速记录场景）
    if (showFavorites) {
      const todo = templates.find(t => t.category === 'todo');
      if (todo) recs.push({ tpl: todo, reason: '快速记录' });
    }
    // 默认推荐空白 + 日记
    const blank = templates.find(t => t.category === 'blank');
    if (blank) recs.push({ tpl: blank, reason: '从空白开始' });
    return recs.slice(0, 2);
  }, [templates, showFavorites, selectedFolderId]);

  const handleSelect = (tpl: NoteTemplate) => {
    const filled = fillTemplateVariables(tpl.content);
    const titleMatch = filled.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';
    onSelect(filled, title);
  };

  // 按分类分组
  const groupedTemplates = useMemo(() => {
    if (!templates) return {} as Record<string, NoteTemplate[]>;
    const filtered = templates.filter(tpl => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q);
      }
      if (activeCategory === 'all') return true;
      return tpl.category === activeCategory;
    });
    const groups: Record<string, NoteTemplate[]> = {};
    filtered.forEach(tpl => {
      if (!groups[tpl.category]) groups[tpl.category] = [];
      groups[tpl.category].push(tpl);
    });
    return groups;
  }, [templates, activeCategory, searchQuery]);

  const hasResults = Object.keys(groupedTemplates).length > 0;

  return (
    <>
      {/* 遮罩 — 与新建文件夹弹窗一致 */}
      <div
        className="z-50 bg-black/20"
        style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong rounded-[28px] p-5 sm:p-6 w-full max-w-md max-h-[85vh] flex flex-col"
        >
          {/* 标题 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="typo-title">选择模板</h3>
            <button
              onClick={onClose}
              className="icon-press w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 搜索框 — iOS 胶囊风格 */}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模板"
              className="w-full pl-9 pr-4 py-2.5 rounded-full bg-white/8 border-0 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:bg-white/12 transition-colors"
            />
          </div>

          {/* 智能推荐 — 上下文感知 */}
          {!searchQuery && recommendations.length > 0 && (
            <div className="mb-4">
              <p className="typo-meta mb-2 px-1 flex items-center gap-1.5">
                <Sparkles size={12} className="text-[var(--accent-mint)]" /> 推荐
              </p>
              <div className="space-y-1.5">
                {recommendations.map(({ tpl, reason }) => {
                  const cfg = CATEGORY_CONFIG[tpl.category] || CATEGORY_CONFIG.custom;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={`rec-${tpl.id}`}
                      onClick={() => handleSelect(tpl)}
                      onMouseEnter={() => setHoveredTpl(tpl.id)}
                      onMouseLeave={() => setHoveredTpl(null)}
                      className="icon-press w-full ios-pill-note flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}20` }}>
                        <Icon size={17} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="typo-note-title">{tpl.name}</div>
                        <div className="typo-meta">{reason}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 分类筛选 — 胶囊标签 */}
          {!searchQuery && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === 'all'
                    ? 'bg-[var(--accent-mint)] text-white'
                    : 'ios-glass-btn text-[var(--text-secondary)]'
                }`}
              >
                全部
              </button>
              {CATEGORY_ORDER.map(cat => {
                const cfg = CATEGORY_CONFIG[cat];
                if (!cfg) return null;
                const count = templates?.filter(t => t.category === cat).length || 0;
                if (count === 0) return null;
                const Icon = cfg.icon;
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                      active ? 'text-white' : 'ios-glass-btn text-[var(--text-secondary)]'
                    }`}
                    style={active ? { background: cfg.color } : {}}
                  >
                    <Icon size={12} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 模板列表 — 按分类分组 */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {hasResults ? (
              <div className="space-y-4">
                {CATEGORY_ORDER.map(cat => {
                  const list = groupedTemplates[cat];
                  if (!list || list.length === 0) return null;
                  const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.custom;
                  const Icon = cfg.icon;
                  return (
                    <div key={cat}>
                      {/* 分类标题 */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Icon size={13} style={{ color: cfg.color }} />
                        <span className="typo-meta">{cfg.label}</span>
                        <span className="typo-meta opacity-50">{list.length}</span>
                      </div>
                      {/* 模板项 */}
                      <div className="space-y-1.5">
                        {list.map(tpl => (
                          <button
                            key={tpl.id}
                            onClick={() => handleSelect(tpl)}
                            onMouseEnter={() => setHoveredTpl(tpl.id)}
                            onMouseLeave={() => setHoveredTpl(null)}
                            className="icon-press w-full ios-pill-note flex items-start gap-3 px-4 py-3 text-left transition-colors"
                          >
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${cfg.color}20` }}>
                              <Icon size={17} style={{ color: cfg.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="typo-note-title truncate">{tpl.name}</span>
                                {tpl.isBuiltIn && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                                    内置
                                  </span>
                                )}
                              </div>
                              <div className="typo-meta mt-0.5 line-clamp-1">{tpl.description}</div>
                              {/* 内容预览 — 悬停时显示 */}
                              <AnimatePresence>
                                {hoveredTpl === tpl.id && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] overflow-hidden"
                                    style={{ background: 'var(--glass-bg)', fontFamily: 'var(--font-mono, monospace)' }}
                                  >
                                    {tpl.content.split('\n').slice(0, 4).join('\n')}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mb-3">
                  <Search size={24} className="text-[var(--text-secondary)]" />
                </div>
                <p className="typo-body text-[var(--text-secondary)]">
                  {searchQuery ? `没有找到「${searchQuery}」相关模板` : '暂无模板'}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
