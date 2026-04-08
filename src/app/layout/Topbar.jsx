import {
  Bell,
  Building2,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Moon,
  PlusSquare,
  Search,
  Settings2,
  ShieldAlert,
  Sun,
  UsersRound,
  Users2,
} from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useErm } from '../context/ErmContext'
import { useI18n } from '../context/I18nContext'
import ProfileMenu from '../../components/common/ProfileMenu'
import LanguageMenu from '../../components/common/LanguageMenu'
import { formatCurrency, formatDate } from '../../lib/format'

const PAGE_SUGGESTIONS = [
  { key: 'dashboard', labelKey: 'nav.dashboard', descriptionKey: 'dashboard.title', path: '/dashboard', icon: LayoutDashboard },
  { key: 'risks', labelKey: 'nav.riskRegister', descriptionKey: 'risks.title', path: '/risks', icon: ShieldAlert },
  { key: 'queue', labelKey: 'nav.reviewQueue', descriptionKey: 'queue.title', path: '/queue', icon: ClipboardList },
  { key: 'committee', labelKey: 'nav.committee', descriptionKey: 'committee.title', path: '/committee', icon: UsersRound },
  { key: 'create', labelKey: 'nav.createRisk', descriptionKey: 'create.title', path: '/create', icon: PlusSquare },
  { key: 'admin', labelKey: 'nav.admin', descriptionKey: 'admin.title', path: '/admin', icon: Settings2 },
]

const ADMIN_SUGGESTIONS = [
  { key: 'departments', labelKey: 'admin.departments', path: '/admin?tab=departments', icon: Building2 },
  { key: 'categories', labelKey: 'admin.categories', path: '/admin?tab=categories', icon: FolderKanban },
  { key: 'users', labelKey: 'admin.users', path: '/admin?tab=users', icon: Users2 },
]

function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase()
}

function matchesSearch(query, ...values) {
  if (!query) {
    return true
  }

  return values.some((value) => normalizeSearchValue(value).includes(query))
}

function sortByMatchPriority(items, query, getLabel) {
  if (!query) {
    return items
  }

  return [...items].sort((left, right) => {
    const leftLabel = normalizeSearchValue(getLabel(left))
    const rightLabel = normalizeSearchValue(getLabel(right))
    const leftStarts = leftLabel.startsWith(query) ? 0 : 1
    const rightStarts = rightLabel.startsWith(query) ? 0 : 1

    if (leftStarts !== rightStarts) {
      return leftStarts - rightStarts
    }

    return leftLabel.localeCompare(rightLabel)
  })
}

export default function Topbar({ onMenuClick }) {
  const {
    globalFilters,
    setGlobalFilters,
    theme,
    setTheme,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    scopedRisks,
  } = useErm()
  const { t, tr } = useI18n()
  const { canAccessPath } = useAuth()
  const navigate = useNavigate()
  const isDark = theme === 'dark'
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const notificationsRef = useRef(null)
  const searchRef = useRef(null)
  const controlClass =
    'h-11 rounded-2xl border border-[#D5DEEB] bg-white px-4 text-sm text-slate-700 outline-none transition-colors focus:border-[#0B4FCF] focus:ring-4 focus:ring-[#0B4FCF]/10 dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF] dark:focus:border-[#7AA2FF] dark:focus:ring-[#749BFF]/20'
  const iconButtonClass =
    'inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D5DEEB] bg-white text-slate-500 transition-colors hover:border-[#BED1F8] hover:bg-[#EEF4FF] hover:text-[#0B4FCF] dark:border-[#274272] dark:bg-[#132547] dark:text-[#C9D8F7] dark:hover:border-[#4569A8] dark:hover:bg-[#1A2F59] dark:hover:text-white'

  const searchQuery = normalizeSearchValue(globalFilters.search)

  const pageSuggestions = useMemo(() => {
    if (!searchQuery) {
      return []
    }

    const matches = PAGE_SUGGESTIONS.filter((item) => {
      if (!canAccessPath(item.path)) {
        return false
      }

      return matchesSearch(
        searchQuery,
        t(item.labelKey),
        t(item.descriptionKey),
      )
    })

    return sortByMatchPriority(matches, searchQuery, (item) => t(item.labelKey))
      .slice(0, 5)
      .map((item) => ({
        ...item,
        kind: 'page',
        title: t(item.labelKey),
        description: t(item.descriptionKey),
      }))
  }, [canAccessPath, searchQuery, t])

  const settingSuggestions = useMemo(() => {
    if (!searchQuery) {
      return []
    }

    if (!canAccessPath('/admin')) {
      return []
    }

    const matches = ADMIN_SUGGESTIONS.filter((item) =>
      matchesSearch(
        searchQuery,
        t(item.labelKey),
        t('admin.title'),
      ),
    )

    return sortByMatchPriority(matches, searchQuery, (item) => t(item.labelKey))
      .slice(0, 3)
      .map((item) => ({
        ...item,
        kind: 'setting',
        title: t(item.labelKey),
        description: t('search.settingsHint'),
      }))
  }, [canAccessPath, searchQuery, t])

  const riskSuggestions = useMemo(() => {
    if (!searchQuery) {
      return []
    }

    const sortedPool = [...scopedRisks].sort(
      (left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime(),
    )

    const filtered = sortedPool.filter((risk) =>
      matchesSearch(
        searchQuery,
        risk.title,
        risk.riskNumber,
        tr('category', risk.category),
        tr('department', risk.department),
        tr('status', risk.status),
        risk.owner,
        risk.responsible,
      ),
    )

    return filtered.slice(0, 6).map((risk) => ({
      id: risk.id,
      kind: 'risk',
      title: risk.title,
      description: `${risk.riskNumber || risk.id} / ${tr('department', risk.department)}`,
      meta: tr('status', risk.status),
      amount: formatCurrency(risk.expectedLoss),
      path: `/risks/${risk.id}`,
    }))
  }, [scopedRisks, searchQuery, tr])

  const sections = useMemo(() => {
    const groups = [
      {
        key: 'pages',
        title: t('search.pagesSection'),
        items: pageSuggestions,
      },
      {
        key: 'settings',
        title: t('search.settingsSection'),
        items: settingSuggestions,
      },
      {
        key: 'risks',
        title: t('search.risksSection'),
        items: riskSuggestions,
      },
    ]

    return groups.filter((group) => group.items.length)
  }, [pageSuggestions, riskSuggestions, searchQuery, settingSuggestions, t])

  const flatSuggestions = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  )

  useEffect(() => {
    if (!flatSuggestions.length) {
      setHighlightedIndex(0)
      return
    }

    setHighlightedIndex((current) => Math.min(current, flatSuggestions.length - 1))
  }, [flatSuggestions])

  useEffect(() => {
    if (!isNotificationsOpen && !isSearchOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false)
      }

      if (!searchRef.current?.contains(event.target)) {
        setIsSearchOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [isNotificationsOpen, isSearchOpen])

  const showSuggestions = isSearchOpen && Boolean(searchQuery)

  const handleSuggestionSelect = (item) => {
    setIsSearchOpen(false)
    setHighlightedIndex(0)
    setGlobalFilters({ search: '' })
    navigate(item.path)
  }

  const handleSearchKeyDown = (event) => {
    if (!showSuggestions || !flatSuggestions.length) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => (current + 1) % flatSuggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => (current - 1 + flatSuggestions.length) % flatSuggestions.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const target = flatSuggestions[highlightedIndex]
      if (target) {
        handleSuggestionSelect(target)
      }
      return
    }

    if (event.key === 'Escape') {
      setIsSearchOpen(false)
    }
  }

  return (
    <header
      className={clsx(
        'sticky top-0 z-20 pb-1 pt-3 backdrop-blur-xl',
        isDark ? 'bg-[#0D162A]/78' : 'bg-[#F4F6FA]/78',
      )}
    >
      <div
        className={clsx(
          'flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:px-4',
          isDark
            ? 'border-[#233B63] bg-[#0F1B34]/94 shadow-[0_14px_38px_rgba(2,8,22,0.28)]'
            : 'border-[#DCE4EF] bg-white/92',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            className={clsx(iconButtonClass, 'lg:hidden')}
            aria-label={t('top.openNavigation')}
            onClick={onMenuClick}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div ref={searchRef} className="relative min-w-0 flex-[1_1_56rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#9EB4E2]" />
            <input
              type="search"
              placeholder={t('top.search')}
              value={globalFilters.search}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              onChange={(event) => {
                setGlobalFilters({ search: event.target.value })
                setIsSearchOpen(true)
                setHighlightedIndex(0)
              }}
              className={clsx(controlClass, 'w-full pl-9')}
            />

            {showSuggestions ? (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-40 overflow-hidden rounded-[24px] border border-[#D9E3F2] bg-white shadow-[0_28px_60px_rgba(15,23,42,0.18)] dark:border-[#274272] dark:bg-[#132547] dark:shadow-[0_24px_56px_rgba(2,8,22,0.4)]">
                <div className="border-b border-[#E5EAF2] px-4 py-3 dark:border-[#274272]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('search.title')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {searchQuery ? t('search.typingHint') : t('search.quickAccessHint')}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#D9E3F2] bg-[#F8FAFD] px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-[#35548A] dark:bg-[#102342] dark:text-[#C9D8F7]">
                      {flatSuggestions.length}
                    </span>
                  </div>
                </div>

                <div className="max-h-[480px] overflow-y-auto p-3">
                  {sections.length ? (
                    <div className="space-y-4">
                      {sections.map((section) => (
                        <section key={section.key}>
                          <div className="mb-2 flex items-center justify-between gap-3 px-1">
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-[#8FA6D5]">
                              {section.title}
                            </h3>
                            <span className="text-[11px] text-slate-400 dark:text-[#8FA6D5]">{section.items.length}</span>
                          </div>

                          <div className="space-y-1.5">
                            {section.items.map((item) => {
                              const index = flatSuggestions.findIndex((candidate) => candidate === item)
                              const isHighlighted = highlightedIndex === index
                              const Icon = item.icon

                              return (
                                <button
                                  key={`${section.key}-${item.key ?? item.id}`}
                                  type="button"
                                  onMouseEnter={() => setHighlightedIndex(index)}
                                  onClick={() => handleSuggestionSelect(item)}
                                  className={clsx(
                                    'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                                    isHighlighted
                                      ? 'border-[#BFD0F5] bg-[#EEF4FF] dark:border-[#4569A8] dark:bg-[#17315E]'
                                      : 'border-transparent bg-transparent hover:border-[#E5EAF2] hover:bg-[#F8FAFD] dark:hover:border-[#274272] dark:hover:bg-[#10203D]',
                                  )}
                                >
                                  <span
                                    className={clsx(
                                      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1',
                                      item.kind === 'risk'
                                        ? 'bg-[#FFF3EC] text-[#DB4300] ring-[#FFD7C5] dark:bg-[#2C1A14] dark:text-[#FFB89A] dark:ring-[#6B3B2A]'
                                        : 'bg-[#F4F8FF] text-[#0041B6] ring-[#D8E6FF] dark:bg-[#102342] dark:text-[#D6E4FF] dark:ring-[#35548A]',
                                    )}
                                  >
                                    {Icon ? <Icon className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                                  </span>

                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {item.title}
                                      </span>
                                      {item.meta ? (
                                        <span className="rounded-full bg-[#E8EFFF] px-2 py-0.5 text-[10px] font-medium text-[#0041B6] dark:bg-[#24467F] dark:text-[#D6E4FF]">
                                          {item.meta}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                                      {item.description}
                                    </span>
                                  </span>

                                  {item.amount ? (
                                    <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-[#D6E4FF]">
                                      {item.amount}
                                    </span>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#D9E3F2] px-4 py-8 text-center dark:border-[#274272]">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('search.emptyTitle')}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('search.emptyDesc')}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden xl:block">
              <LanguageMenu />
            </div>

            <button
              type="button"
              className={iconButtonClass}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={t('top.switchMode', { mode: theme === 'light' ? t('top.dark') : t('top.light') })}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                className={clsx(iconButtonClass, 'relative')}
                aria-label={t('top.notifications')}
                onClick={() => setIsNotificationsOpen((current) => !current)}
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationCount ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#DB4300] px-1.5 text-[10px] font-semibold text-white">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                ) : null}
              </button>

              {isNotificationsOpen ? (
                <div className="absolute right-0 top-14 z-20 w-[360px] rounded-2xl border border-[#D9D9D9] bg-white p-3 shadow-xl dark:border-[#274272] dark:bg-[#132547]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('top.notifications')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t('top.notificationsHelper')}</p>
                    </div>
                    {notifications.length ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-[#0041B6] hover:text-[#003693] dark:text-[#8DB0FF] dark:hover:text-white"
                        onClick={markAllNotificationsRead}
                      >
                        {t('top.markAllRead')}
                      </button>
                    ) : null}
                  </div>

                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {notifications.length ? (
                      notifications.map((notification) => (
                        <Link
                          key={notification.id}
                          to={`/risks/${notification.riskId}`}
                          className={clsx(
                            'block rounded-xl border px-3 py-2 transition-colors',
                            notification.read
                              ? 'border-[#E5EAF2] bg-[#F8FAFD] hover:bg-[#EEF3FB] dark:border-[#274272] dark:bg-[#10203D] dark:hover:bg-[#16305D]'
                              : 'border-[#BFD0F5] bg-[#EEF4FF] hover:bg-[#E3EDFF] dark:border-[#4569A8] dark:bg-[#17315E] dark:hover:bg-[#1B3A70]',
                          )}
                          onClick={() => {
                            markNotificationRead(notification.id)
                            setIsNotificationsOpen(false)
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {notification.title}
                              </p>
                              <p className="mt-0.5 break-words text-xs text-slate-600 dark:text-slate-300">
                                {notification.message || notification.riskTitle || t('dashboard.riskRecord')}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                {notification.riskId} · {formatDate(notification.at)}
                              </p>
                            </div>
                            {!notification.read ? (
                              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#DB4300]" />
                            ) : null}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#D9D9D9] px-3 py-6 text-center text-sm text-slate-500 dark:border-[#274272] dark:text-slate-400">
                        {t('top.notificationsEmpty')}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <ProfileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
