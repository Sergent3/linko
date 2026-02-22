import type { TagSource } from '@/types/api';

const styles: Record<TagSource, string> = {
  REGEX: 'bg-violet-950/60 text-violet-300 border border-violet-800/40',
  AI: 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/40',
  MANUAL: 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40',
};

export default function TagBadge({ name, source }: { name: string; source: TagSource }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] rounded-md font-medium ${styles[source]}`}>
      {name}
    </span>
  );
}
