import Dexie, { type Table } from 'dexie';
import type { Note, NoteVersion, Folder, Tag, Attachment, CloudAccount, SyncLog, NoteTemplate } from '../types';

export class MemoFlowDB extends Dexie {
  notes!: Table<Note, string>;
  noteVersions!: Table<NoteVersion, string>;
  folders!: Table<Folder, string>;
  tags!: Table<Tag, string>;
  attachments!: Table<Attachment, string>;
  cloudAccounts!: Table<CloudAccount, string>;
  syncLogs!: Table<SyncLog, string>;
  templates!: Table<NoteTemplate, string>;

  constructor() {
    super('MemoFlowDB');

    // version 5: 完整 schema（含 templates 表）
    // 跳过 v3/v4 的升级路径问题，直接声明所有表
    this.version(5).stores({
      notes: 'id, folderId, isPinned, isArchived, updatedAt, syncStatus, isEncrypted, *tagIds',
      noteVersions: 'id, noteId, createdAt, version',
      folders: 'id, parentId, sortOrder',
      tags: 'id, name',
      attachments: 'id, noteId, type',
      cloudAccounts: 'id, provider',
      syncLogs: 'id, noteId, provider, timestamp',
      templates: 'id, category, isBuiltIn, createdAt',
    });
  }
}

export const db = new MemoFlowDB();

export async function seedDatabase() {
  const count = await db.folders.count();
  if (count > 0) return;

  const now = Date.now();
  await db.folders.bulkAdd([
    { id: 'folder-local', name: 'Memo本地备忘录', icon: '📝', color: '#2dd4bf', parentId: null, sortOrder: 0, createdAt: now },
    { id: 'folder-work', name: '工作', icon: '💼', color: '#38bdf8', parentId: null, sortOrder: 1, createdAt: now },
    { id: 'folder-personal', name: '个人', icon: '🏡', color: '#2dd4bf', parentId: null, sortOrder: 2, createdAt: now },
    { id: 'folder-ideas', name: '灵感', icon: '💡', color: '#fbbf24', parentId: null, sortOrder: 3, createdAt: now },
  ]);
  await db.notes.bulkAdd([
    {
      id: 'note-welcome', title: '欢迎使用 MemoFlow',
      content: '# 欢迎使用 MemoFlow\n\n**让你的记忆，自由流动。**\n\nMemoFlow 是一个极简而强大的备忘录应用，核心区别在于：\n\n- 📦 **自由导入导出** — 不被任何生态锁定\n- ☁️ **多云盘同步** — 百度网盘、Google Drive、夸克、OneDrive\n- 🔒 **数据自主** — 你的笔记永远属于你\n- ✨ **极简设计** — 玻璃拟态美学\n\n## 快速开始\n\n1. 点击左上角 **+** 创建新笔记\n2. 使用 **Markdown** 格式编辑\n3. 在 **云同步** 页面连接你的网盘\n4. 在 **数据迁移** 页面导入已有笔记\n\n> 提示：支持从 Apple Notes、Markdown、TXT、PDF、JSON 导入',
      plainText: '欢迎使用 MemoFlow 让你的记忆自由流动',
      folderId: 'folder-local', tagIds: [],
      isPinned: true, isLocked: false, isArchived: false, isEncrypted: false,
      attachments: [], createdAt: now, updatedAt: now, syncStatus: 'local',
    },
    {
      id: 'note-shortcuts', title: 'Markdown 快捷语法',
      content: '# Markdown 快捷语法\n\n## 标题\n`# H1` `## H2` `### H3`\n\n## 文字格式\n- **粗体**: `**文字**`\n- *斜体*: `*文字*`\n- ~~删除线~~: `~~文字~~`\n\n## 列表\n1. 有序列表\n2. 第二项\n\n- 无序列表\n- 另一项\n\n## 引用\n> 这是一段引用\n\n## 代码块\n```javascript\nconsole.log("Hello MemoFlow");\n```\n\n## 表格\n| 格式 | 支持导出 |\n|------|--------|\n| Markdown | ✅ |\n| PDF | ✅ |\n| JSON | ✅ |',
      plainText: 'Markdown 快捷语法 标题 粗体 斜体 列表 引用 代码块 表格',
      folderId: 'folder-work', tagIds: [],
      isPinned: false, isLocked: false, isArchived: false, isEncrypted: false,
      attachments: [], createdAt: now - 86400000, updatedAt: now - 3600000, syncStatus: 'local',
    },
    {
      id: 'note-ideas', title: '产品灵感记录',
      content: '# 产品灵感\n\n## 核心理念\n> 让你的记忆，自由流动。\n\n## 差异化\n1. **多云盘** — 不是单一生态的附庸\n2. **导入导出** — 数据迁移零摩擦\n3. **AI 第二大脑** — 智能整理知识\n\n## 下一步\n- [x] MVP 核心功能\n- [ ] AI 自动标签\n- [ ] AI 内容摘要\n- [ ] 端到端加密',
      plainText: '产品灵感 核心理念 多云盘 导入导出 AI 第二大脑',
      folderId: 'folder-ideas', tagIds: [],
      isPinned: false, isLocked: false, isArchived: false, isEncrypted: false,
      attachments: [], createdAt: now - 172800000, updatedAt: now - 7200000, syncStatus: 'local',
    },
  ]);
}

// 连接网盘时自动创建对应文件夹
const CLOUD_FOLDER_MAP: Record<string, { name: string; icon: string; color: string }> = {
  baidu: { name: '百度备忘录', icon: '☁️', color: '#38bdf8' },
  quark: { name: '夸克备忘录', icon: '⚡', color: '#fbbf24' },
  google: { name: 'Google备忘录', icon: '📁', color: '#34a853' },
  onedrive: { name: 'One备忘录', icon: 'Cloud', color: '#0078d4' },
};

export async function ensureCloudFolder(provider: string) {
  const config = CLOUD_FOLDER_MAP[provider];
  if (!config) return;
  const folderId = `folder-cloud-${provider}`;
  const existing = await db.folders.get(folderId);
  if (existing) return;
  const count = await db.folders.count();
  await db.folders.add({
    id: folderId,
    name: config.name,
    icon: config.icon,
    color: config.color,
    parentId: null,
    sortOrder: count,
    createdAt: Date.now(),
  });
}

// 清理旧的默认标签（仅执行一次）
const MIGRATION_KEY = 'memoflow-migration-v3';

export async function cleanupDefaultTags() {
  // 检查是否已执行过迁移
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const defaultTagIds = ['tag-important', 'tag-todo', 'tag-done'];
  const allTags = await db.tags.toArray();
  const toDelete = allTags.filter(t =>
    defaultTagIds.includes(t.id) || t.name === '学习笔记'
  );
  if (toDelete.length === 0) {
    localStorage.setItem(MIGRATION_KEY, 'done');
    return;
  }

  for (const tag of toDelete) {
    const notesWithTag = await db.notes.where('tagIds').equals(tag.id).toArray();
    for (const note of notesWithTag) {
      await db.notes.update(note.id, { tagIds: note.tagIds.filter(id => id !== tag.id) });
    }
    await db.tags.delete(tag.id);
  }

  localStorage.setItem(MIGRATION_KEY, 'done');
}

// 初始化内置模板
export async function seedTemplates() {
  const count = await db.templates.count();
  if (count > 0) return;

  const now = Date.now();
  await db.templates.bulkAdd([
    {
      id: 'tpl-blank',
      name: '空白笔记',
      icon: '📄',
      description: '从零开始',
      content: '',
      category: 'blank',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-diary',
      name: '日记',
      icon: '📅',
      description: '记录今天',
      content: `# 📅 {{date}}

## 心情


## 今日记录


## 感恩
-

## 明日计划
- [ ] `,
      category: 'diary',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-meeting',
      name: '会议记录',
      icon: '👥',
      description: '高效会议',
      content: `# 📋 会议记录

**日期：** {{date}}
**参会人：**
**地点：**

## 议题
1.

## 讨论


## 决议
-

## 待办事项
- [ ] @某人 — 事项描述
- [ ] @某人 — 事项描述

---
> 下次会议：`,
      category: 'meeting',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-todo',
      name: '待办清单',
      icon: '✅',
      description: '今日任务',
      content: `# ✅ 待办清单

**{{date}}**

## 今日任务
- [ ]
- [ ]
- [ ]

## 进行中
- [ ]

## 已完成
- [x]

## 备注
`,
      category: 'todo',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-reading',
      name: '读书笔记',
      icon: '📖',
      description: '深度阅读',
      content: `# 📖 《书名》

**作者：**
**阅读日期：** {{date}}
**评分：** ⭐⭐⭐⭐⭐

## 核心观点


## 精彩摘录
>

## 个人感悟


## 行动计划
- [ ] `,
      category: 'reading',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-project',
      name: '项目计划',
      icon: '🚀',
      description: '项目启动',
      content: `# 🚀 项目名称

**开始日期：** {{date}}
**负责人：**
**状态：** 规划中

## 项目概述


## 目标
1.
2.
3.

## 里程碑
| 阶段 | 截止日期 | 状态 |
|------|---------|------|
|  |  |  |

## 任务分解
- [ ]
- [ ]

## 风险与依赖
- `,
      category: 'project',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}
