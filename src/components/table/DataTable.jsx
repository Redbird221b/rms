import { ArrowLeft, ArrowRight, ArrowUpDown, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function normalizeStoragePageSize(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE
  }

  const normalized = Math.max(1, Math.floor(value))
  return PAGE_SIZE_OPTIONS.includes(normalized) ? normalized : DEFAULT_PAGE_SIZE
}

function buildPageSizeStorageKey(storageKey) {
  return `${storageKey}:pageSize`
}

function clampPage(page, pageCount) {
  if (pageCount <= 0) {
    return 1
  }
  if (page < 1) {
    return 1
  }
  if (page > pageCount) {
    return pageCount
  }
  return page
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
  compactRowRenderer,
}) {
  const { t } = useI18n()
  const normalizedStorageKey = storageKey ? String(storageKey) : null
  const initialPreferences = normalizedStorageKey
    ? loadFromStorage(normalizedStorageKey, {
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
  const [requestedPage, setRequestedPage] = useState(1)
  const [pageSize, setPageSize] = useState(
    normalizedStorageKey
      ? normalizeStoragePageSize(
          loadFromStorage(buildPageSizeStorageKey(normalizedStorageKey), DEFAULT_PAGE_SIZE),
        )
      : DEFAULT_PAGE_SIZE,
  )
  const settingsRef = useRef(null)

  useEffect(() => {
    if (!normalizedStorageKey) {
      return
    }
    saveToStorage(normalizedStorageKey, { visibleColumns, density })
  }, [density, normalizedStorageKey, visibleColumns])

  useEffect(() => {
    if (!normalizedStorageKey) {
      return
    }
    saveToStorage(buildPageSizeStorageKey(normalizedStorageKey), pageSize)
  }, [pageSize, normalizedStorageKey])

  useEffect(() => {
    if (!showSettings) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!settingsRef.current?.contains(event.target)) {
        setShowSettings(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowSettings(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showSettings])

  const activeColumns = useMemo(
    () =>
      columns.filter((column) => {
        if (visibleColumns[column.key] === false) {
          return false
        }
        if (density === 'compact' && column.compactHidden) {
          return false
        }
        return true
      }),
    [columns, density, visibleColumns],
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

  const pageCount = useMemo(() => {
    if (!pageSize) {
      return 1
    }
    const rowCount = sortedData?.length || 0
    return Math.max(1, Math.ceil(rowCount / pageSize))
  }, [pageSize, sortedData])

  const safePage = clampPage(requestedPage, pageCount)
  const hasPagination = pageCount > 1

  const pagedData = useMemo(() => {
    if (!safePage || !pageSize) {
      return sortedData
    }

    const start = (safePage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [pageSize, safePage, sortedData])

  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-3.5'
  const headerPadding = density === 'compact' ? 'py-1.5' : 'py-2'
  const bodyTextClass = density === 'compact' ? 'text-[13px]' : 'text-sm'
  const hasHeaderTitle = Boolean(title)

  const renderCell = (column, row) => (column.render ? column.render(row, { density }) : row[column.key])

  const goToPage = (nextPage) => {
    setRequestedPage(clampPage(nextPage, pageCount))
  }

  const goPrev = () => {
    goToPage(safePage - 1)
  }

  const goNext = () => {
    goToPage(safePage + 1)
  }

  const handleSort = (key) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
    setRequestedPage(1)
  }

  return (
    <div className="panel overflow-visible rounded-[24px] dark:border-[#314E82] dark:bg-[#132445]">
      <div
        className={clsx(
          'flex flex-wrap items-center gap-2 px-4 py-3',
          hasHeaderTitle
            ? 'justify-between border-b border-[#D9D9D9] bg-[#FBFCFE] dark:border-[#2F4878] dark:bg-[#10203D]'
            : 'justify-end bg-transparent pb-2',
        )}
      >
        {hasHeaderTitle ? <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3> : null}
        <div ref={settingsRef} className="relative flex items-center gap-2">
          <div className="rounded-xl border border-[#D9D9D9] p-0.5 dark:border-[#2F4878]">
            <button
              type="button"
              className={clsx(
                'rounded-lg px-2.5 py-1 text-xs',
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
                'rounded-lg px-2.5 py-1 text-xs',
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
            className="inline-flex items-center gap-1 rounded-xl border border-[#D9D9D9] px-3 py-2 text-xs text-slate-600 hover:bg-[#F6F8FC] dark:border-[#2F4878] dark:text-[#D8E5FF] dark:hover:bg-[#1A2F59]"
            aria-expanded={showSettings}
            aria-haspopup="dialog"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t('table.columns')}
          </button>
          {showSettings ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] dark:border-[#2F4878] dark:bg-[#13264A]">
              <div className="border-b border-[#E7EDF6] px-3 py-2 dark:border-[#274370]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-[#8FA6D5]">
                  {t('table.columns')}
                </p>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
                {columns.map((column) => (
                  <label
                    key={column.key}
                    className="mb-1 flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-[#D8E5FF] dark:hover:bg-[#1A2F59]"
                  >
                    <span className="min-w-0 truncate">{column.label}</span>
                    <input
                      type="checkbox"
                      checked={visibleColumns[column.key] !== false}
                      onChange={(event) =>
                        setVisibleColumns((current) => ({
                          ...current,
                          [column.key]: event.target.checked,
                        }))
                      }
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-[#0041B6] focus:ring-[#0041B6]"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {pagedData.length ? (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {pagedData.map((row) => {
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
            {density === 'compact' && compactRowRenderer ? (
              <div className="grid gap-3 bg-white p-3 md:grid-cols-2 2xl:grid-cols-3 dark:bg-[#132445]">
                {pagedData.map((row) => (
                  <div
                    key={row[rowKey]}
                    className={clsx(
                      'h-full rounded-2xl border border-[#D9D9D9] bg-[#FBFCFE] p-4 dark:border-[#2F4878] dark:bg-[#10203D]',
                      onRowClick ? 'cursor-pointer transition-colors hover:bg-white dark:hover:bg-[#17305A]' : '',
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {compactRowRenderer(row)}
                  </div>
                ))}
              </div>
            ) : (
              <table className="min-w-full">
                <thead className="sticky top-0 z-[1] bg-[#F6F8FC] dark:bg-[#10203D]">
                  <tr>
                    {activeColumns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={clsx(
                          `whitespace-nowrap px-4 ${headerPadding} text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400`,
                          column.align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {column.sortable ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => handleSort(column.key)}
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
                <tbody className="divide-y divide-[#D9D9D9] bg-white dark:divide-[#2F4878] dark:bg-[#132445]">
                  {pagedData.map((row) => (
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
                            `px-4 ${bodyTextClass} text-slate-700 dark:text-slate-200 ${rowPadding}`,
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
            )}
          </div>
          {hasPagination ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D9D9E5] bg-[#F6F8FC] px-3 py-2 text-xs dark:border-[#2B4774] dark:bg-[#10203D]">
              <button
                type="button"
                onClick={goPrev}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-[#CBD7EE] px-2.5 py-1.5 text-slate-600 hover:bg-[#EAF0FC] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2F4878] dark:text-[#D8E5FF] dark:hover:bg-[#17305A]"
                aria-label="Предыдущая"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Предыдущая
              </button>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#D4E0F4] px-2 py-1 text-[11px] text-slate-500 dark:border-[#2F4878] dark:text-[#90ADD9]">
                  {safePage} / {pageCount}
                </span>
                <span className="text-slate-500 dark:text-[#9FB4D9]">
                  Записей: {sortedData.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-lg border border-[#C6D2E8] bg-white px-2 py-1 text-[11px] dark:border-[#35548A] dark:bg-[#13264A]"
                  value={pageSize}
    onChange={(event) => {
      const nextSize = normalizeStoragePageSize(event.target.value)
      setPageSize(nextSize)
      setRequestedPage(1)
    }}
  >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={safePage >= pageCount}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#CBD7EE] px-2.5 py-1.5 text-slate-600 hover:bg-[#EAF0FC] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2F4878] dark:text-[#D8E5FF] dark:hover:bg-[#17305A]"
                  aria-label="Следующая"
                >
                  Следующая
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="p-5">{emptyState}</div>
      )}
    </div>
  )
}
