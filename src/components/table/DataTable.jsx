import { ArrowUpDown, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { loadFromStorage, saveToStorage } from '../../lib/storage'
import { useI18n } from '../../app/context/I18nContext'

function getComparableValue(value) {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const date = Date.parse(value)
    if (!Number.isNaN(date) && value.includes('-')) {
      return date
    }
    return value.toLowerCase()
  }
  return value ?? ''
}

export default function DataTable({
  title,
  columns,
  data,
  rowKey = 'id',
  initialSort = { key: '', direction: 'desc' },
  storageKey,
  onRowClick,
  emptyState,
}) {
  const { t } = useI18n()

  const initialPreferences = storageKey
    ? loadFromStorage(storageKey, {
        visibleColumns: Object.fromEntries(
          columns.map((column) => [column.key, column.defaultVisible !== false]),
        ),
        density: 'comfortable',
      })
    : {
        visibleColumns: Object.fromEntries(
          columns.map((column) => [column.key, column.defaultVisible !== false]),
        ),
        density: 'comfortable',
      }

  const [sort, setSort] = useState(initialSort)
  const [showSettings, setShowSettings] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns)
  const [density, setDensity] = useState(initialPreferences.density)

  useEffect(() => {
    if (!storageKey) {
      return
    }
    saveToStorage(storageKey, { visibleColumns, density })
  }, [density, storageKey, visibleColumns])

  const activeColumns = useMemo(
    () => columns.filter((column) => visibleColumns[column.key] !== false),
    [columns, visibleColumns],
  )

  const sortedData = useMemo(() => {
    if (!sort?.key) {
      return data
    }
    const target = columns.find((column) => column.key === sort.key)
    if (!target) {
      return data
    }
    const copy = [...data]
    copy.sort((a, b) => {
      const rawA = target.sortValue ? target.sortValue(a) : a[target.key]
      const rawB = target.sortValue ? target.sortValue(b) : b[target.key]
      const valA = getComparableValue(rawA)
      const valB = getComparableValue(rawB)

      if (valA < valB) {
        return sort.direction === 'asc' ? -1 : 1
      }
      if (valA > valB) {
        return sort.direction === 'asc' ? 1 : -1
      }
      return 0
    })
    return copy
  }, [columns, data, sort])

  const rowPadding = density === 'compact' ? 'py-2' : 'py-3.5'
  const renderCell = (column, row) => (column.render ? column.render(row) : row[column.key])

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9D9D9] px-4 py-3 dark:border-[#2F4878]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <div className="relative flex items-center gap-2">
          <div className="rounded-lg border border-[#D9D9D9] p-0.5 dark:border-[#2F4878]">
            <button
              type="button"
              className={clsx(
                'rounded-md px-2 py-1 text-xs',
                density === 'comfortable'
                  ? 'bg-[#0041B6] text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-[#C9D8F7] dark:hover:bg-[#1A2F59]',
              )}
              onClick={() => setDensity('comfortable')}
            >
              {t('table.comfortable')}
            </button>
            <button
              type="button"
              className={clsx(
                'rounded-md px-2 py-1 text-xs',
                density === 'compact'
                  ? 'bg-[#0041B6] text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-[#C9D8F7] dark:hover:bg-[#1A2F59]',
              )}
              onClick={() => setDensity('compact')}
            >
              {t('table.compact')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((open) => !open)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D9D9D9] px-2.5 py-1.5 text-xs text-slate-600 hover:bg-[#F6F8FC] dark:border-[#2F4878] dark:text-[#D8E5FF] dark:hover:bg-[#1A2F59]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t('table.columns')}
          </button>
          {showSettings ? (
            <div className="absolute right-0 top-10 z-10 w-48 rounded-lg border border-[#D9D9D9] bg-white p-2 shadow-sm dark:border-[#2F4878] dark:bg-[#13264A]">
              {columns.map((column) => (
                <label
                  key={column.key}
                  className="mb-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:text-[#D8E5FF] dark:hover:bg-[#1A2F59]"
                >
                  <span>{column.label}</span>
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key] !== false}
                    onChange={(event) =>
                      setVisibleColumns((current) => ({
                        ...current,
                        [column.key]: event.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#0041B6] focus:ring-[#0041B6]"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {sortedData.length ? (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {sortedData.map((row) => {
              const primaryColumn =
                activeColumns.find((column) => column.key === 'title') ??
                activeColumns.find((column) => column.key === 'id') ??
                activeColumns[0]

              return (
                <div
                  key={row[rowKey]}
                  className={clsx(
                    'rounded-2xl border border-[#D9D9D9] bg-white p-4 dark:border-[#2F4878] dark:bg-[#10203D]/72',
                    onRowClick ? 'cursor-pointer transition-colors hover:bg-[#F8FAFF] dark:hover:bg-[#17305A]' : '',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {primaryColumn?.label}
                    </div>
                    <div className="mt-2 min-w-0 text-sm text-slate-700 dark:text-slate-200">
                      {primaryColumn ? renderCell(primaryColumn, row) : row[rowKey]}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {activeColumns
                      .filter((column) => column.key !== primaryColumn?.key)
                      .map((column) => (
                        <div key={`${row[rowKey]}-${column.key}`} className="grid gap-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {column.label}
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200">
                            {renderCell(column, row)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full">
            <thead className="bg-[#F6F8FC] dark:bg-[#0F1E3A]">
              <tr>
                {activeColumns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={clsx(
                      'whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
                      column.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() =>
                          setSort((current) => ({
                            key: column.key,
                            direction:
                              current.key === column.key && current.direction === 'desc' ? 'asc' : 'desc',
                          }))
                        }
                      >
                        {column.label}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9] bg-white dark:divide-[#2F4878] dark:bg-[#13264A]/70">
              {sortedData.map((row) => (
                <tr
                  key={row[rowKey]}
                  className={clsx(
                    onRowClick
                      ? 'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#1A2F59]/70'
                      : '',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {activeColumns.map((column) => (
                    <td
                      key={`${row[rowKey]}-${column.key}`}
                      className={clsx(
                        `px-4 text-sm text-slate-700 dark:text-slate-200 ${rowPadding}`,
                        column.align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      {renderCell(column, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <div className="p-5">{emptyState}</div>
      )}
    </div>
  )
}
