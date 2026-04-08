import { useEffect, useMemo, useState } from 'react'
import { Building2, FolderKanban, Search, ShieldCheck, TriangleAlert, Users2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import Tabs from '../components/common/Tabs'
import { severityThresholds } from '../lib/compute'
import { formatCurrency } from '../lib/format'

const ADMIN_TABS = ['departments', 'categories', 'statuses', 'thresholds', 'users']

function resolveAdminTab(value) {
  return ADMIN_TABS.includes(value) ? value : 'departments'
}

function hasPersistentId(item) {
  return item?.id !== null && item?.id !== undefined && item?.id !== ''
}

function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase()
}

function ReadOnlyBadge({ label }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-[#17305B] dark:text-[#C7D8FF]">
      {label}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, tone = 'default' }) {
  const toneClassName =
    tone === 'warning'
      ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-800/70'
      : tone === 'success'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-800/70'
        : 'bg-[#F4F8FF] text-[#0041B6] ring-[#D8E6FF] dark:bg-[#17305B] dark:text-[#C7D8FF] dark:ring-[#2F4878]'

  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${toneClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  )
}

function AdminSearch({ value, onChange, placeholder, t }) {
  return (
    <label className="block">
      <span className="sr-only">{t('admin.searchLabel')}</span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="input-field w-full pl-9"
        />
      </span>
    </label>
  )
}

function ResultSummary({ total, visible, t }) {
  const message =
    total === visible
      ? t('admin.searchResults', { count: total })
      : t('admin.searchResultsFiltered', { count: visible, total })

  return <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
}

function ReferenceCrudTab({
  title,
  itemLabel,
  items,
  searchQuery,
  onCreate,
  onUpdate,
  onDelete,
  addToast,
  t,
}) {
  const [newName, setNewName] = useState('')
  const [editingKey, setEditingKey] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyKey, setBusyKey] = useState(null)
  const hasReadonlyItems = items.some((item) => !hasPersistentId(item))

  const visibleItems = useMemo(() => {
    const query = normalizeSearchValue(searchQuery)
    if (!query) {
      return items
    }

    return items.filter((item) => normalizeSearchValue(item.name).includes(query))
  }, [items, searchQuery])

  const resetEditing = () => {
    setEditingKey(null)
    setEditingValue('')
  }

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      addToast({ type: 'error', title: t('admin.validationTitle'), message: t('admin.validationName') })
      return
    }

    setCreating(true)
    try {
      await onCreate(trimmed)
      addToast({
        type: 'success',
        title: t('admin.itemCreated'),
        message: trimmed,
      })
      setNewName('')
    } catch (error) {
      addToast({
        type: 'error',
        title: t('admin.actionFailed'),
        message: error.message,
      })
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (item) => {
    const trimmed = editingValue.trim()
    if (!trimmed) {
      addToast({ type: 'error', title: t('admin.validationTitle'), message: t('admin.validationName') })
      return
    }

    setBusyKey(item.clientKey)
    try {
      await onUpdate(item, trimmed)
      addToast({
        type: 'success',
        title: t('admin.itemUpdated'),
        message: trimmed,
      })
      resetEditing()
    } catch (error) {
      addToast({
        type: 'error',
        title: t('admin.actionFailed'),
        message: error.message,
      })
    } finally {
      setBusyKey(null)
    }
  }

  const handleDelete = async (item) => {
    setBusyKey(item.clientKey)
    try {
      await onDelete(item)
      addToast({
        type: 'success',
        title: t('admin.itemDeleted'),
        message: item.name,
      })
    } catch (error) {
      addToast({
        type: 'error',
        title: t('admin.actionFailed'),
        message: error.message,
      })
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="panel p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('admin.manageHint', { item: itemLabel })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResultSummary total={items.length} visible={visibleItems.length} t={t} />
          {hasReadonlyItems ? <ReadOnlyBadge label={t('admin.partialCrud')} /> : null}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#2F4878] dark:bg-[#10203D]/70">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('admin.nameField')}</span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="input-field"
              placeholder={t('admin.namePlaceholder', { item: itemLabel })}
            />
          </label>
          <button type="button" className="btn-primary h-11 self-end" onClick={handleCreate} disabled={creating}>
            {creating ? t('admin.creating') : t('admin.createAction')}
          </button>
        </div>
      </div>

      {hasReadonlyItems ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          {t('admin.backendIdHint')}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#2F4878] dark:bg-[#10203D]/70">
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_220px] gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-[#2F4878] dark:bg-[#0E1D38] dark:text-slate-400 md:grid">
          <span>{t('admin.nameField')}</span>
          <span>{t('admin.sourceLabel')}</span>
          <span className="text-right">{t('admin.actionsLabel')}</span>
        </div>

        {visibleItems.length ? (
          <div className="divide-y divide-slate-200 dark:divide-[#243D69]">
            {visibleItems.map((item) => {
              const mutable = hasPersistentId(item)
              const isEditing = editingKey === item.clientKey
              const isBusy = busyKey === item.clientKey

              if (isEditing) {
                return (
                  <article key={item.clientKey} className="px-4 py-4">
                    <div className="space-y-3">
                      <input
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        className="input-field"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" className="btn-secondary" onClick={resetEditing}>
                          {t('admin.cancelEdit')}
                        </button>
                        <button type="button" className="btn-primary" onClick={() => void handleUpdate(item)} disabled={isBusy}>
                          {t('admin.saveAction')}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              }

              return (
                <article
                  key={item.clientKey}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_140px_220px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-950 dark:text-white">{item.name}</p>
                    {!mutable ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('admin.readOnlyItem')}</p>
                    ) : null}
                  </div>
                  <div>
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-[#17305B] dark:text-[#C7D8FF]">
                      {mutable ? t('admin.sourceBackend') : t('admin.sourceLocal')}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      disabled={!mutable || isBusy}
                      onClick={() => {
                        setEditingKey(item.clientKey)
                        setEditingValue(item.name)
                      }}
                    >
                      {t('admin.editAction')}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      disabled={!mutable || isBusy}
                      onClick={() => void handleDelete(item)}
                    >
                      {t('admin.deleteAction')}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="px-4 py-10">
            <EmptyState
              title={searchQuery ? t('admin.noMatches') : t('admin.noItems')}
              description={searchQuery ? t('admin.tryAnotherSearch') : ''}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function ReadOnlyGridTab({ title, hint, count, children, t }) {
  return (
    <section className="panel p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResultSummary total={count} visible={count} t={t} />
          <ReadOnlyBadge label={t('admin.readOnlyBadge')} />
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function Admin() {
  const {
    departmentItems,
    categoryItems,
    users,
    statuses,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    createCategory,
    updateCategory,
    deleteCategory,
    addToast,
    isBackendConnected,
    backendError,
  } = useErm()
  const { t, tr } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => resolveAdminTab(searchParams.get('tab')))
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const nextTab = resolveAdminTab(searchParams.get('tab'))
    setActiveTab((current) => (current === nextTab ? current : nextTab))
  }, [searchParams])

  if (!isBackendConnected && !backendError) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">Loading backend data...</section>
  }

  if (!isBackendConnected && backendError) {
    return <EmptyState title="Backend unavailable" description={backendError || 'Unable to load data from backend.'} />
  }

  const tabs = [
    { value: 'departments', label: t('admin.departments') },
    { value: 'categories', label: t('admin.categories') },
    { value: 'statuses', label: t('admin.statuses') },
    { value: 'thresholds', label: t('admin.thresholds') },
    { value: 'users', label: t('admin.users') },
  ]

  const userQuery = normalizeSearchValue(searchQuery)
  const filteredUsers = !userQuery
    ? users
    : users.filter((user) => {
        const haystack = [
          user.name,
          user.role,
          user.accessRole,
          user.department,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(userQuery)
      })

  const summaryCards = [
    { key: 'departments', label: t('admin.departments'), value: departmentItems.length, icon: Building2 },
    { key: 'categories', label: t('admin.categories'), value: categoryItems.length, icon: FolderKanban },
    { key: 'statuses', label: t('admin.statuses'), value: statuses.length, icon: ShieldCheck },
    { key: 'users', label: t('admin.users'), value: users.length, icon: Users2 },
  ]

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('admin.overviewLabel')}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{t('admin.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('admin.subtitle')}</p>
          </div>
          <div className="w-full max-w-xl">
            <AdminSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('admin.searchPlaceholder')}
              t={t}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <StatCard key={card.key} icon={card.icon} label={card.label} value={card.value} />
          ))}
        </div>
      </section>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(value) => {
          const nextTab = resolveAdminTab(value)
          setActiveTab(nextTab)
          setSearchQuery('')
          setSearchParams((current) => {
            const nextParams = new URLSearchParams(current)
            nextParams.set('tab', nextTab)
            return nextParams
          })
        }}
      />

      {activeTab === 'departments' ? (
        <ReferenceCrudTab
          title={t('admin.departments')}
          itemLabel={t('admin.departmentSingular')}
          items={departmentItems}
          searchQuery={searchQuery}
          onCreate={createDepartment}
          onUpdate={updateDepartment}
          onDelete={deleteDepartment}
          addToast={addToast}
          t={t}
        />
      ) : null}

      {activeTab === 'categories' ? (
        <ReferenceCrudTab
          title={t('admin.categories')}
          itemLabel={t('admin.categorySingular')}
          items={categoryItems}
          searchQuery={searchQuery}
          onCreate={createCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
          addToast={addToast}
          t={t}
        />
      ) : null}

      {activeTab === 'statuses' ? (
        <ReadOnlyGridTab title={t('admin.statuses')} hint={t('admin.statusesHint')} count={statuses.length} t={t}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {statuses.map((status) => (
              <div
                key={status}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm font-medium text-slate-700 dark:border-[#2F4878] dark:bg-[#10203D]/70 dark:text-slate-200"
              >
                {tr('status', status)}
              </div>
            ))}
          </div>
        </ReadOnlyGridTab>
      ) : null}

      {activeTab === 'thresholds' ? (
        <ReadOnlyGridTab title={t('admin.thresholds')} hint={t('admin.thresholdsHint')} count={severityThresholds.length} t={t}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#2F4878] dark:bg-[#10203D]/70">
            <div className="hidden grid-cols-[minmax(0,1fr)_220px] gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-[#2F4878] dark:bg-[#0E1D38] dark:text-slate-400 md:grid">
              <span>{t('admin.nameField')}</span>
              <span>{t('admin.rangeLabel')}</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#243D69]">
              {severityThresholds.map((threshold) => (
                <article
                  key={threshold.label}
                  className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[minmax(0,1fr)_220px] md:items-center"
                >
                  <span className="font-medium text-slate-950 dark:text-white">{tr('severity', threshold.label)}</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatCurrency(threshold.min)} - {Number.isFinite(threshold.max) ? formatCurrency(threshold.max) : '?'}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </ReadOnlyGridTab>
      ) : null}

      {activeTab === 'users' ? (
        <ReadOnlyGridTab title={t('admin.users')} hint={t('admin.usersHint')} count={filteredUsers.length} t={t}>
          {filteredUsers.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#2F4878] dark:bg-[#10203D]/70">
              <div className="hidden grid-cols-[minmax(0,1.1fr)_180px_minmax(0,1fr)_150px] gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-[#2F4878] dark:bg-[#0E1D38] dark:text-slate-400 lg:grid">
                <span>{t('admin.nameField')}</span>
                <span>{t('admin.roleLabel')}</span>
                <span>{t('admin.departments')}</span>
                <span>{t('admin.accessLabel')}</span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-[#243D69]">
                {filteredUsers.map((user) => (
                  <article
                    key={user.id}
                    className="grid gap-2 px-4 py-4 text-sm lg:grid-cols-[minmax(0,1.1fr)_180px_minmax(0,1fr)_150px] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-950 dark:text-white">{user.name}</p>
                    </div>
                    <span className="text-slate-600 dark:text-slate-300">{user.role}</span>
                    <span className="text-slate-600 dark:text-slate-300">{tr('department', user.department)}</span>
                    <span className="inline-flex w-fit rounded-full bg-[#E8EFFF] px-2.5 py-1 text-[11px] font-medium text-[#0041B6] dark:bg-[#17305B] dark:text-[#C7D8FF]">
                      {user.accessRole}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title={t('admin.noMatches')} description={t('admin.tryAnotherSearch')} />
          )}
        </ReadOnlyGridTab>
      ) : null}
    </div>
  )
}
