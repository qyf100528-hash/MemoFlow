/**
 * DeepSeek API 调用客户端
 * 
 * 支持自动标签、内容摘要、知识库语义搜索
 * API 密钥存储在用户设置中 (localStorage)
 */

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/**
 * 获取存储的 API 密钥
 */
function getApiKey(): string | null {
  try {
    const raw = localStorage.getItem('memoflow-store');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const key: string | undefined = parsed?.state?.settings?.deepseekApiKey;
    return key && key.trim().length > 0 ? key.trim() : null;
  } catch {
    return null;
  }
}

/**
 * 检查 API 密钥是否已配置
 */
export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

/**
 * 调用 DeepSeek Chat API
 */
export async function callDeepSeek(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY_MISSING');
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 800,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`DEEPSEEK_API_ERROR:${response.status}:${errBody}`);
  }

  const data: ChatCompletionResponse = await response.json();
  return data.choices[0].message.content;
}

// ─── 提示词模板 ────────────────────────────────────

const SYSTEM_PROMPT_TAG = `你是一个智能笔记标签助手。你的任务是根据笔记内容，从已有的标签列表中选出最匹配的标签ID列表。

规则：
- 只返回 JSON 数组格式：["tagId1", "tagId2"]
- 每个标签最多返回一次
- 如果没有任何标签匹配，返回空数组 []
- 不要返回任何解释文字，只返回 JSON
- 标签选择基于语义相关性，而非简单的关键词匹配`;

const SYSTEM_PROMPT_SUMMARY = `你是一个笔记摘要助手。请用简洁的语言总结笔记的核心内容。

规则：
- 返回 2-4 句中文摘要
- 保持客观，不要添加原文没有的信息
- 突出关键观点和结论
- 不要使用 Markdown 格式
- 直接返回摘要文本，不要加引号或前缀`;

const SYSTEM_PROMPT_SEARCH = `你是一个知识库搜索助手。分析用户的搜索查询，返回最相关的笔记ID列表。

规则：
- 只返回 JSON 数组格式：["noteId1", "noteId2"]
- 基于语义相关性排序，最相关的排前面
- 如果没有任何笔记匹配，返回空数组 []
- 不要返回任何解释文字，只返回 JSON
- 考虑同义词和上下文相关性`;

/**
 * 使用 DeepSeek 进行语义标签提取
 */
export async function semanticAutoTag(
  content: string,
  availableTags: { id: string; name: string }[]
): Promise<string[]> {
  if (!content || availableTags.length === 0) return [];

  const tagList = availableTags.map(t => `${t.id}:${t.name}`).join('\n');
  const userPrompt = `现有标签列表：\n${tagList}\n\n笔记内容：\n${content.slice(0, 3000)}\n\n请返回匹配的标签ID数组。`;

  const result = await callDeepSeek([
    { role: 'system', content: SYSTEM_PROMPT_TAG },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.2, maxTokens: 300 });

  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // 尝试从文本中提取 JSON 数组
    const match = result.match(/\[.*?\]/s);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed : [];
      } catch {}
    }
    return [];
  }
}

/**
 * 使用 DeepSeek 生成语义摘要
 */
export async function semanticSummarize(
  content: string,
  title?: string
): Promise<string> {
  const prefix = title ? `标题：${title}\n\n` : '';
  const userPrompt = `${prefix}笔记内容：\n${content.slice(0, 4000)}`;

  return callDeepSeek([
    { role: 'system', content: SYSTEM_PROMPT_SUMMARY },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.3, maxTokens: 500 });
}

/**
 * 使用 DeepSeek 进行语义搜索排序
 */
export async function semanticSearch(
  query: string,
  notes: { id: string; title: string; content: string }[]
): Promise<string[]> {
  if (!query || notes.length === 0) return [];

  const noteList = notes.map(n => `ID:${n.id}\n标题:${n.title}\n内容:${n.content.slice(0, 500)}`).join('\n---\n');
  const userPrompt = `搜索查询：${query}\n\n笔记列表：\n${noteList}\n\n请返回最相关的笔记ID数组（按相关性从高到低）。`;

  const result = await callDeepSeek([
    { role: 'system', content: SYSTEM_PROMPT_SEARCH },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.2, maxTokens: 500 });

  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = result.match(/\[.*?\]/s);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed : [];
      } catch {}
    }
    return [];
  }
}