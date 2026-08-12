import { Fragment } from 'react';

interface Props {
  text: string;
  query: string;
  className?: string;
}

/**
 * 将文本中匹配查询的部分以高亮包裹返回，支持大小写不敏感。
 * 用于笔记列表项和搜索结果中突出显示匹配的关键词。
 */
export function HighlightText({ text, query, className }: Props) {
  if (!query.trim() || !text) {
    return <span className={className}>{text}</span>;
  }
  const q = query.trim();
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark key={i} className="bg-[var(--accent-mint)]/30 text-[var(--accent-mint)] rounded px-0.5">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}