export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle ? (
          <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 xl:justify-end">{actions}</div> : null}
    </header>
  )
}
