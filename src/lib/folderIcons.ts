import {
  Folder, Briefcase, Home, Lightbulb, FileText, Star, Pin, Target,
  Library, Palette, Music, Plane, House, Heart, Flame, Sparkles,
  type LucideIcon,
} from 'lucide-react';

/** 文件夹图标映射 — key 存入 DB 的 icon 字段，value 为 lucide 组件 */
export const FOLDER_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  briefcase: Briefcase,
  home: Home,
  lightbulb: Lightbulb,
  file: FileText,
  star: Star,
  pin: Pin,
  target: Target,
  library: Library,
  palette: Palette,
  music: Music,
  plane: Plane,
  house: House,
  heart: Heart,
  flame: Flame,
  sparkles: Sparkles,
};

/** 图标选项列表（含 key + label），供新建文件夹弹窗使用 */
export const FOLDER_ICON_OPTIONS = Object.keys(FOLDER_ICONS);

/** 默认文件夹图标 key */
export const DEFAULT_FOLDER_ICON = 'folder';

/** 兼容旧 emoji 数据：把旧的 emoji 映射到新的 key */
const EMOJI_TO_KEY: Record<string, string> = {
  '📁': 'folder',
  '💼': 'briefcase',
  '🏡': 'home',
  '💡': 'lightbulb',
  '📝': 'file',
  '⭐': 'star',
  '📌': 'pin',
  '🎯': 'target',
  '📚': 'library',
  '🎨': 'palette',
  '🎵': 'music',
  '✈️': 'plane',
  '🏠': 'house',
  '❤️': 'heart',
  '🔥': 'flame',
  '🌟': 'sparkles',
};

/** 根据 icon 字段获取 lucide 组件，兼容旧 emoji 数据 */
export function getFolderIcon(icon: string): LucideIcon {
  return FOLDER_ICONS[icon] || FOLDER_ICONS[EMOJI_TO_KEY[icon] || ''] || Folder;
}
