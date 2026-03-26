import { useState } from 'react'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import Tabs from '../components/common/Tabs'
import PageHeader from '../components/common/PageHeader'
import { severityThresholds } from '../lib/compute'
import { formatCurrency } from '../lib/format'

function hasPersistentId(item) {
  return item?.id !== null && item?.id !== undefined && item?.id !== ''
}

function ReadOnlyBadge({ label }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-[#17305B] dark:text-[#C7D8FF]">
      {label}
    </span>
  )
}

function ReferenceCrudTab({
  title,
  itemLabel,
  items,
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('admin.manageHint', { item: itemLabel })}</p>
        </div>
        {hasReadonlyItems ? <ReadOnlyBadge label={t('admin.partialCrud')} /> : null}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#2F4878] dark:bg-[#10203D]/70">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('admin.nameField')}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="input-field"
              placeholder={t('admin.namePlaceholder', { item: itemLabel })}
            />
            <button type="button" className="btn-primary sm:min-w-36" onClick={handleCreate} disabled={creating}>
              {creating ? t('admin.creating') : t('admin.createAction')}
            </button>
          </div>
        </label>
      </div>

      {hasReadonlyItems ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          {t('admin.backendIdHint')}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {items.length ? (
          items.map((item) => {
            const mutable = hasPersistentId(item)
            const isEditing = editingKey === item.clientKey
            const isBusy = busyKey === item.clientKey

            return (
              <article
                key={item.clientKey}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#2F4878] dark:bg-[#10203D]/70"
              >
                {isEditing ? (
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
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                      {!mutable ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('admin.readOnlyItem')}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                  </div>
                )}
              </article>
            )
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-[#34507F] dark:text-slate-400">
            {t('admin.noItems')}
          </div>
        )}
      </div>
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
  } = useErm()
  const { t, tr } = useI18n()
  const [activeTab, setActiveTab] = useState('departments')

  const tabs = [
    { value: 'departments', label: t('admin.departments') },
    { value: 'categories', label: t('admin.categories') },
    { value: 'statuses', label: t('admin.statuses') },
    { value: 'thresholds', label: t('admin.thresholds') },
    { value: 'users', label: t('admin.users') },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'departments' ? (
        <ReferenceCrudTab
          title={t('admin.departments')}
          itemLabel={t('admin.departmentSingular')}
          items={departmentItems}
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
          onCreate={createCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
          addToast={addToast}
          t={t}
        />
      ) : null}

      {activeTab === 'statuses' ? (
        <section className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.statuses')}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('admin.readOnlyHint')}</p>
            </div>
            <ReadOnlyBadge label={t('admin.readOnlyBadge')} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
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
      ) : null}

      {activeTab === 'thresholds' ? (
        <section className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.thresholds')}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('admin.readOnlyHint')}</p>
            </div>
            <ReadOnlyBadge label={t('admin.readOnlyBadge')} />
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
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
      ) : null}

      {activeTab === 'users' ? (
        <section className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('admin.users')}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('admin.readOnlyHint')}</p>
            </div>
            <ReadOnlyBadge label={t('admin.readOnlyBadge')} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-[#2F4878] dark:bg-[#10203D]/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{tr('department', user.department)}</p>
                  </div>
                  <span className="rounded-full bg-[#E8EFFF] px-2.5 py-1 text-[11px] font-medium text-[#0041B6] dark:bg-[#17305B] dark:text-[#C7D8FF]">
                    {user.accessRole}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
