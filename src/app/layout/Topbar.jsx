import { Bell, ChevronDown, Menu, Moon, Search, Sun } from 'lucide-react'
import clsx from 'clsx'
import { useErm } from '../context/ErmContext'
import { useI18n } from '../context/I18nContext'

export default function Topbar({ onMenuClick }) {
  const { globalFilters, setGlobalFilters, theme, setTheme, departments, statuses } = useErm()
  const { language, setLanguage, supportedLanguages, t, tr } = useI18n()
  const isDark = theme === 'dark'
  const selectClass =
    'h-10 rounded-lg border border-[#ACACAC] bg-[#F7F8FB] px-2.5 text-sm text-slate-700 outline-none focus:border-[#0041B6] dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF]'
  const iconButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D9D9D9] text-slate-500 hover:bg-[#E8EFFF] hover:text-[#0041B6] dark:border-[#274272] dark:text-[#C9D8F7] dark:hover:bg-[#1A2F59] dark:hover:text-white'

  return (
    <header
      className={clsx(
        'sticky top-0 z-10 border-b backdrop-blur-sm',
        isDark ? 'border-[#233B63] bg-[#0F1B34]/95' : 'border-[#D9D9D9] bg-white/95',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-3 px-4 sm:px-6 lg:px-8">
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
            className="h-10 w-full rounded-lg border border-[#ACACAC] bg-[#F7F8FB] pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors focus:border-[#0041B6] focus:ring-2 focus:ring-[#0041B6]/20 dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF] dark:focus:ring-[#749BFF]/30"
          />
        </div>
        <div className="hidden items-center gap-2 xl:flex">
          <select
            value={globalFilters.department}
            onChange={(event) => setGlobalFilters({ department: event.target.value })}
            className={selectClass}
            aria-label={t('filters.department')}
          >
            <option value="All">{t('top.allDepartments')}</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {tr('department', department)}
              </option>
            ))}
          </select>
          <select
            value={globalFilters.status}
            onChange={(event) => setGlobalFilters({ status: event.target.value })}
            className={selectClass}
            aria-label={t('filters.status')}
          >
            <option value="All">{t('top.allStatuses')}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {tr('status', status)}
              </option>
            ))}
          </select>
        </div>
        <label className="hidden h-10 items-center gap-2 rounded-lg border border-[#ACACAC] bg-[#F7F8FB] px-2.5 text-xs text-slate-700 lg:flex dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF]">
          <span>{t('top.language')}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className={clsx(
              'h-7 rounded-md px-1.5 text-xs outline-none transition-colors',
              isDark
                ? 'bg-[#1A2F59] text-[#E5ECFF] hover:bg-[#223A6D]'
                : 'bg-white text-slate-700 hover:bg-[#EFF3FC]',
            )}
            aria-label={t('top.language')}
          >
            {supportedLanguages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={iconButtonClass}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={t('top.switchMode', { mode: theme === 'light' ? t('top.dark') : t('top.light') })}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className={iconButtonClass}
          aria-label={t('top.notifications')}
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="hidden h-10 items-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-sm text-slate-700 hover:bg-[#F6F8FC] md:flex dark:border-[#274272] dark:text-[#E5ECFF] dark:hover:bg-[#1A2F59]"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DB4300] text-xs font-semibold text-white dark:bg-[#DB4300]/80 dark:text-white">
            RM
          </span>
          <span>{t('top.riskManager')}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </header>
  )
}
