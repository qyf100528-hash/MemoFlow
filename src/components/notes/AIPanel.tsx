import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Tags, FileText, Search, X, AlertCircle, CheckCircle2, Brain } from 'lucide-react';
import { autoTag, searchKnowledgeBase, summarizeContent } from '../../lib/ai';
import { hasApiKey } from '../../lib/ai/deepseek';
import type { Note } from '../../types';

interface Props {
  note: Note;
  onApplyTags: (tagIds: string[]) => void;
  onClose: () => void;
}

export function AIPanel({ note, onApplyTags, onClose }: Props) {
  const [suggestedTags, setSuggestedTags] = useState<string[] | null>(null);
  const [searchResults, setSearchResults] = useState<{ note: Note; relevance: number }[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagLoading, setTagLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSemantic, setIsSemantic] = useState(false);

  const apiKeyConfigured = hasApiKey();

  useEffect(() => {
    if (apiKeyConfigured) {
      setIsSemantic(true);
    }
  }, [apiKeyConfigured]);

  const clearError = () => setError(null);

  const handleAutoTag = async () => {
    setTagLoading(true);
    setError(null);
    try {
      const tagIds = await autoTag(note);
      setSuggestedTags(tagIds);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '标签分析失败');
    } finally {
      setTagLoading(false);
    }
  };

  const handleSummary = async () => {
    setSummaryLoading(true);
    setError(null);
    try {
      const s = await summarizeContent(note.content);
      setSummary(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '摘要生成失败');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError(null);
    try {
      const results = await searchKnowledgeBase(searchQuery);
      setSearchResults(results.map(r => ({ note: r.note, relevance: r.relevance })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleApplyTags = () => {
    if (suggestedTags) {
      onApplyTags(suggestedTags);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={16} className="text-[var(--accent-violet)]" />
          AI 助手
          {isSemantic && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--accent-mint)] bg-[var(--accent-mint)]/10 px-1.5 py-0.5 rounded-full">
              <Brain size={10} />
              DeepSeek
            </span>
          )}
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-[var(--text-secondary)]">
          <X size={14} />
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl"
        >
          <AlertCircle size={12} />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="hover:text-red-300"><X size={12} /></button>
        </motion.div>
      )}

      {/* API 未配置提示 */}
      {!apiKeyConfigured && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-[10px] leading-relaxed">
          当前使用本地关键词匹配。在设置中配置 DeepSeek API 密钥可获得语义级智能分析。
        </div>
      )}

      <div className="space-y-3">
        {/* 自动标签 */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Tags size={12} />
              自动标签
            </div>
            <button
              onClick={handleAutoTag}
              disabled={tagLoading}
              className="glass px-3 py-1 rounded-lg text-xs text-[var(--accent-violet)] hover:bg-white/10 disabled:opacity-50"
            >
              {tagLoading ? (
                <span className="flex items-center gap-1">
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="inline-block">
                    <Brain size={12} />
                  </motion.span>
                  分析中...
                </span>
              ) : '分析'}
            </button>
          </div>
          {suggestedTags && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-secondary)]">推荐标签：</span>
              {suggestedTags.length > 0 ? (
                <>
                  <span className="text-xs text-[var(--accent-mint)] flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    {suggestedTags.length} 个匹配
                  </span>
                  <button onClick={handleApplyTags} className="glass px-2 py-0.5 rounded-lg text-xs text-[var(--accent-mint)]">应用</button>
                </>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">暂无匹配标签</span>
              )}
            </div>
          )}
        </div>

        {/* 内容摘要 */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <FileText size={12} />
              内容摘要
            </div>
            <button
              onClick={handleSummary}
              disabled={summaryLoading}
              className="glass px-3 py-1 rounded-lg text-xs text-[var(--accent-violet)] hover:bg-white/10 disabled:opacity-50"
            >
              {summaryLoading ? (
                <span className="flex items-center gap-1">
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="inline-block">
                    <Brain size={12} />
                  </motion.span>
                  生成中...
                </span>
              ) : '生成'}
            </button>
          </div>
          {summary && <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{summary}</p>}
        </div>

        {/* 知识库搜索 */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-2">
            <Search size={12} />
            知识库搜索
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索所有笔记..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--glass-border)] text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              className="glass px-3 py-1.5 rounded-lg text-xs text-[var(--accent-violet)] disabled:opacity-50"
            >
              {searchLoading ? (
                <span className="flex items-center gap-1">
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="inline-block">
                    <Brain size={12} />
                  </motion.span>
                  搜索
                </span>
              ) : '搜索'}
            </button>
          </div>
          {searchResults && searchResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
              {searchResults.map((r, i) => (
                <div key={i} className="text-xs px-2 py-1 rounded-lg bg-white/5 flex items-center gap-2">
                  <span className="text-[var(--accent-mint)]">{Math.round(r.relevance * 100)}%</span>
                  <span className="truncate text-[var(--text-primary)]">{r.note.title || '无标题'}</span>
                </div>
              ))}
            </div>
          )}
          {searchResults && searchResults.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">未找到相关内容</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}