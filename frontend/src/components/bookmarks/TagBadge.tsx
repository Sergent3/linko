import type { TagSource } from '@/types/api';

const cls: Record<TagSource, string> = {
  REGEX: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  AI:    'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  MANUAL:'text-zinc-400  bg-zinc-800/80     border-zinc-700/40',
};

export default function TagBadge({ name, source }: { name: string; source: TagSource }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border ${cls[source]}`}>
      {name}
    </span>
  );
}
