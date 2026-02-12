import { formatDate } from '../../lib/format'
import { useI18n } from '../../app/context/I18nContext'

export default function AuditTimeline({ items = [] }) {
  const { t } = useI18n()

  if (!items.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{t('audit.noEvents')}</p>
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="relative pl-6">
          <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#0041B6]" />
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2F4878] dark:bg-[#13264A]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(item.at)} · {item.by}
              </span>
            </div>
            {item.notes ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.notes}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}


