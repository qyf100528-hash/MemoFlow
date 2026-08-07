import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { fillTemplateVariables } from '../../lib/templates';
import type { NoteTemplate } from '../../types';

interface Props {
  onSelect: (content: string, title: string) => void;
  onClose: () => void;
}

export function TemplatePicker({ onSelect, onClose }: Props) {
  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').toArray(), []);

  const handleSelect = (tpl: NoteTemplate) => {
    const filled = fillTemplateVariables(tpl.content);
    // 从模板内容提取标题（第一个 # 行）
    const titleMatch = filled.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].replace(/[📅📋✅📖🚀📄]/g, '').trim() : '';
    onSelect(filled, title);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">选择模板</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {templates?.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleSelect(tpl)}
              className="glass-card p-4 text-left hover:border-[var(--accent-mint)] transition-all group"
            >
              <div className="text-3xl mb-2">{tpl.icon}</div>
              <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{tpl.name}</div>
              <div className="text-xs text-[var(--text-secondary)] line-clamp-2">{tpl.description}</div>
              {tpl.isBuiltIn && (
                <div className="mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded-md glass text-[var(--text-secondary)]">内置</div>
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
