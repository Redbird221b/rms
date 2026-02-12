export function SkeletonCard() {
  return (
    <div className="panel p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-[#1A2F59]" />
      <div className="mt-3 h-7 w-40 animate-pulse rounded bg-slate-200 dark:bg-[#1A2F59]" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-[#1A2F59]" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2F4878]">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-[#1A2F59]" />
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="px-4 py-3">
            <div className="h-3.5 w-full animate-pulse rounded bg-slate-200 dark:bg-[#1A2F59]" />
          </div>
        ))}
      </div>
    </div>
  )
}

