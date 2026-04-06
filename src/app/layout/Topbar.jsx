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
    'h-11 rounded-2xl border border-[#D5DEEB] bg-white px-4 text-sm text-slate-700 outline-none transition-colors focus:border-[#0B4FCF] focus:ring-4 focus:ring-[#0B4FCF]/10 dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF] dark:focus:border-[#7AA2FF] dark:focus:ring-[#749BFF]/20'
  const iconButtonClass =
    'inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D5DEEB] bg-white text-slate-500 transition-colors hover:border-[#BED1F8] hover:bg-[#EEF4FF] hover:text-[#0B4FCF] dark:border-[#274272] dark:bg-[#132547] dark:text-[#C9D8F7] dark:hover:border-[#4569A8] dark:hover:bg-[#1A2F59] dark:hover:text-white'

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
        'sticky top-0 z-20 px-4 pb-1 pt-3 backdrop-blur-xl sm:px-6 lg:px-8 xl:px-10',
        isDark ? 'bg-[#0D162A]/78' : 'bg-[#F4F6FA]/78',
      )}
    >
      <div
        className={clsx(
          'mx-auto flex max-w-[1680px] items-center gap-3 rounded-[24px] border px-3 py-3 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:px-4',
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

          <div className="relative min-w-0 flex-1 max-w-[720px]">
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
