import { Bell, Menu, Moon, Search, Sun } from 'lucide-react'
import clsx from 'clsx'
import { useErm } from '../context/ErmContext'
import { useI18n } from '../context/I18nContext'
import ProfileMenu from '../../components/common/ProfileMenu'
import LanguageMenu from '../../components/common/LanguageMenu'

export default function Topbar({ onMenuClick }) {
  const { globalFilters, setGlobalFilters, theme, setTheme } = useErm()
  const { t } = useI18n()
  const isDark = theme === 'dark'
  const controlClass =
    'h-10 rounded-xl border border-[#D9D9D9] bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-[#0041B6] focus:ring-2 focus:ring-[#0041B6]/20 dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF] dark:focus:ring-[#749BFF]/30'
  const iconButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9D9D9] bg-white text-slate-500 transition-colors hover:bg-[#E8EFFF] hover:text-[#0041B6] dark:border-[#274272] dark:bg-[#132547] dark:text-[#C9D8F7] dark:hover:bg-[#1A2F59] dark:hover:text-white'

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

            <button type="button" className={iconButtonClass} aria-label={t('top.notifications')}>
              <Bell className="h-4 w-4" />
            </button>

            <ProfileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
