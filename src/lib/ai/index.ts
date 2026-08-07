import { db } from '../db';
import type { Note, Tag } from '../../types';
import {
  hasApiKey,
  semanticAutoTag,
  semanticSummarize,
  semanticSearch,
} from './deepseek';

/**
 * AI 服务 — 自动标签、内容摘要、知识库搜索
 *
 * 支持本地关键词匹配（降级）和 DeepSeek API 语义分析（优先）
 */

// 本地关键词匹配（降级方案）
const TAG_KEYWORDS: Record<string, string[]> = {
  '重要': ['重要', '紧急', '关键', '必须', 'essential', 'urgent', 'critical'],
  '待办': ['待办', 'todo', '任务', '完成', '需做', '需要', '计划', 'task', 'pending'],
  '已完成': ['完成', 'done', '完成', '已实现', 'finished', 'completed'],
  '想法': ['想法', '灵感', 'idea', '创意', '创新', '创意', '建议', 'brainstorm'],
  '学习': ['学习', '教程', '课程', '学习', 'study', 'learn', 'course', '教程', '笔记'],
  '工作': ['工作', '项目', '会议', '报告', 'work', 'project', 'meeting', 'report', '方案'],
  '个人': ['个人', '生活', '日记', 'personal', 'diary', 'life', 'daily'],
};

/**
 * 自动标签：优先使用 DeepSeek 语义分析，降级为关键词匹配
 */
export async function autoTag(note: Pick<Note, 'title' | 'content'>): Promise<string[]> {
  const text = `${note.title} ${note.content}`.trim();
  if (!text) return [];

  const existingTags = await db.tags.toArray();
  if (existingTags.length === 0) return [];

  // 优先使用 DeepSeek API
  if (hasApiKey()) {
    try {
      const tagIds = await semanticAutoTag(text, existingTags.map(t => ({ id: t.id, name: t.name })));
      // 校验返回的 ID 是否有效
      const validIds = tagIds.filter(id => existingTags.some(t => t.id === id));
      if (validIds.length > 0) return validIds;
    } catch (err) {
      console.warn('DeepSeek autoTag failed, falling back to keyword matching:', err);
      // 降级到关键词匹配
    }
  }

  // 降级：关键词匹配
  const lowerText = text.toLowerCase();
  const matchedTagNames: string[] = [];

  for (const [tagName, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
      matchedTagNames.push(tagName);
    }
  }

  if (matchedTagNames.length === 0) return [];

  return existingTags
    .filter(t => matchedTagNames.includes(t.name))
    .map(t => t.id);
}

/**
 * 内容摘要：优先使用 DeepSeek API 生成语义摘要，降级为句子提取
 */
export async function summarizeContent(text: string, maxSentences: number = 3): Promise<string> {
  if (!text) return '';

  // 优先使用 DeepSeek API
  if (hasApiKey()) {
    try {
      return await semanticSummarize(text);
    } catch (err) {
      console.warn('DeepSeek summarize failed, falling back to local:', err);
      // 降级
    }
  }

  // 降级：提取前 N 个句子
  const cleanText = text
    .replace(/[#*`>\-|_\[\]()]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  if (!cleanText) return '';

  const sentences = cleanText
    .split(/[。！？\n.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  if (sentences.length === 0) return cleanText.slice(0, 100);

  return sentences.slice(0, maxSentences).join('。') + '。';
}

/**
 * 知识库搜索：优先使用 DeepSeek 语义搜索，降级为关键词匹配
 */
export async function searchKnowledgeBase(query: string): Promise<{
  note: Note;
  relevance: number;
  matches: string[];
}[]> {
  if (!query || query.trim().length < 2) return [];

  const allNotes = await db.notes.toArray();
  if (allNotes.length === 0) return [];

  // 优先使用 DeepSeek 语义搜索
  if (hasApiKey()) {
    try {
      const rankedIds = await semanticSearch(
        query,
        allNotes.map(n => ({ id: n.id, title: n.title, content: n.content }))
      );
      if (rankedIds.length > 0) {
        const idOrder = new Map(rankedIds.map((id, i) => [id, i]));
        const results = allNotes
          .filter(n => idOrder.has(n.id))
          .sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999))
          .map(n => ({
            note: n,
            relevance: Math.max(0, 1 - (idOrder.get(n.id) ?? 0) / rankedIds.length),
            matches: ['语义匹配'],
          }));
        if (results.length > 0) return results;
      }
    } catch (err) {
      console.warn('DeepSeek search failed, falling back to keyword matching:', err);
    }
  }

  // 降级：关键词匹配
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);
  if (keywords.length === 0) return [];

  const results: { note: Note; relevance: number; matches: string[] }[] = [];

  for (const note of allNotes) {
    const searchableText = `${note.title} ${note.content} ${note.plainText}`.toLowerCase();
    const matches: string[] = [];
    let matchCount = 0;

    for (const keyword of keywords) {
      if (searchableText.includes(keyword)) {
        matchCount++;
        matches.push(keyword);
      }
    }

    if (matchCount > 0) {
      let relevance = matchCount / keywords.length;
      if (note.title.toLowerCase().includes(keywords[0])) {
        relevance += 0.3;
      }
      results.push({ note, relevance, matches });
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * 为笔记生成 AI 摘要（异步，包装函数）
 */
export async function generateNoteSummary(noteId: string): Promise<string | null> {
  const note = await db.notes.get(noteId);
  if (!note || !note.content) return null;

  return summarizeContent(note.content);
}