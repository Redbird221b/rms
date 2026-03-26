import { Bell, Menu, Moon, Search, Sun } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useErm } from '../context/ErmContext'
import { useI18n } from '../context/I18nContext'
import ProfileMenu from '../../components/common/ProfileMenu'
import LanguageMenu from '../../components/common/LanguageMenu'
import { formatDate } from '../../lib/format'

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
  } = useErm()
  const { t } = useI18n()
  const isDark = theme === 'dark'
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationsRef = useRef(null)
  const controlClass =
    'h-10 rounded-xl border border-[#D9D9D9] bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-[#0041B6] focus:ring-2 focus:ring-[#0041B6]/20 dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF] dark:focus:ring-[#749BFF]/30'
  const iconButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9D9D9] bg-white text-slate-500 transition-colors hover:bg-[#E8EFFF] hover:text-[#0041B6] dark:border-[#274272] dark:bg-[#132547] dark:text-[#C9D8F7] dark:hover:bg-[#1A2F59] dark:hover:text-white'

  useEffect(() => {
    if (!isNotificationsOpen) {
      return undefined
    }

    const handleClickOutside = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [isNotificationsOpen])

  return (
    <header
      className={clsx(
        'sticky top-0 z-10 border-b backdrop-blur-xl',
        isDark
          ? 'border-[#233B63] bg-[#0F1B34]/94 shadow-[0_1px_0_rgba(3,8,20,0.35)]'
          : 'border-[#D6DDE8] bg-[#F5F7FB]/95 shadow-[0_1px_0_rgba(15,23,42,0.05)]',
      )}
    >
      <div className="mx-auto max-w-[1680px] px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            className={clsx(iconButtonClass, 'lg:hidden')}
            aria-label={t('top.openNavigation')}
            onClick={onMenuClick}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#9EB4E2]" />
            <input
              type="search"
              placeholder={t('top.search')}
              value={globalFilters.search}
              onChange={(event) => setGlobalFilters({ search: event.target.value })}
              className={clsx(controlClass, 'w-full pl-9')}
            />
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
                <div className="absolute right-0 top-12 z-20 w-[360px] rounded-2xl border border-[#D9D9D9] bg-white p-3 shadow-xl dark:border-[#274272] dark:bg-[#132547]">
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
