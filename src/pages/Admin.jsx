import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import PageHeader from '../components/common/PageHeader'
import { severityThresholds } from '../lib/compute'
import { formatCurrency } from '../lib/format'

export default function Admin() {
  const { departments, categories, users, statuses } = useErm()
  const { t, tr } = useI18n()

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.departments')}</h2>
          <ul className="mt-3 space-y-1">
            {departments.map((department) => (
              <li key={department} className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-[#10203D]/75">
                {tr('department', department)}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.categories')}</h2>
          <ul className="mt-3 space-y-1">
            {categories.map((category) => (
              <li key={category} className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-[#10203D]/75">
                {tr('category', category)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.statuses')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {statuses.map((status) => (
              <span
                key={status}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-[#2F4878]"
              >
                {tr('status', status)}
              </span>
            ))}
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.thresholds')}</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {severityThresholds.map((threshold) => (
              <li key={threshold.label} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-[#10203D]/75">
                <span className="font-medium">{tr('severity', threshold.label)}</span>
                <span className="ml-1">
                  {formatCurrency(threshold.min)} -{' '}
                  {Number.isFinite(threshold.max) ? formatCurrency(threshold.max) : '?'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.users')}</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <article
              key={user.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-[#2F4878] dark:bg-[#10203D]/70"
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{tr('department', user.department)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

