import type { TagSource } from '@/types/api';

const sourceColors: Record<TagSource, string> = {
  REGEX: 'bg-blue-50 text-blue-700',
  AI: 'bg-purple-50 text-purple-700',
  MANUAL: 'bg-gray-100 text-gray-700',
};

export default function TagBadge({
  name,
  source,
}: {
  name: string;
  source: TagSource;
}) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${sourceColors[source]}`}
    >
      {name}
    </span>
  );
}
