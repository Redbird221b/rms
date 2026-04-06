import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  PlusSquare,
  Settings2,
  ShieldAlert,
  UsersRound,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useErm } from '../context/ErmContext'
import { useI18n } from '../context/I18nContext'
import { PERMISSIONS } from '../../lib/access'

const navItems = [
  { labelKey: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.VIEW_DASHBOARD },
  { labelKey: 'nav.riskRegister', path: '/risks', icon: ShieldAlert, permission: PERMISSIONS.VIEW_RISKS },
  { labelKey: 'nav.reviewQueue', path: '/queue', icon: ClipboardList, permission: PERMISSIONS.REVIEW_QUEUE_ACTIONS },
  { labelKey: 'nav.committee', path: '/committee', icon: UsersRound, permission: PERMISSIONS.COMMITTEE_DECIDE },
  { labelKey: 'nav.createRisk', path: '/create', icon: PlusSquare, permission: PERMISSIONS.CREATE_RISK },
  { labelKey: 'nav.admin', path: '/admin', icon: Settings2, permission: PERMISSIONS.MANAGE_REFERENCE_DATA },
]

function SidebarPanel({
  availableItems,
  collapsed,
  onNavigate,
  showCloseButton = false,
  onClose,
  onToggleCollapsed,
}) {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <div
      className={clsx(
        'flex h-full flex-col overflow-hidden border-r border-[#D7E1F0] bg-[#FBFCFE] text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-[#21395F] dark:bg-[#0F1B34] dark:text-slate-100',
        collapsed ? 'items-center px-3 py-4' : 'px-5 py-5',
      )}
    >
      <div
        className={clsx(
          'mb-6 flex w-full border-b border-[#E6EDF7] pb-5 dark:border-[#1C3156]',
          collapsed ? 'flex-col items-center gap-3' : 'items-center justify-between gap-3',
        )}
      >
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className={clsx(
            'group flex min-w-0 items-center transition-opacity hover:opacity-95',
            collapsed ? 'justify-center' : 'gap-3',
          )}
          title={collapsed ? 'UZCARD' : undefined}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D74D1_0%,#0041B6_55%,#002A76_100%)] text-white shadow-[0_10px_24px_rgba(0,65,182,0.24)] ring-1 ring-[#8DB0FF]/35">
            <span className="text-[12px] font-black tracking-[0.18em]">UZ</span>
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black uppercase tracking-[0.18em] text-[#17346A] dark:text-white">
                UZCARD
              </p>
              <p className="truncate text-[12px] text-slate-500 dark:text-blue-100/80">{t('nav.portalTitle')}</p>
            </div>
          ) : null}
        </Link>

        <div className={clsx('flex shrink-0 items-center gap-2', collapsed ? 'flex-col' : 'flex-row')}>
          {typeof onToggleCollapsed === 'function' ? (
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[#D7E1F0] bg-white text-slate-500 transition-colors hover:bg-[#EEF4FF] hover:text-[#0041B6] dark:border-[#274272] dark:bg-[#132547] dark:text-[#C9D8F7] dark:hover:bg-[#1A2F59] dark:hover:text-white lg:inline-flex"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              onClick={onToggleCollapsed}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : null}

          {showCloseButton ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D7E1F0] bg-white text-slate-600 transition-colors hover:bg-[#EEF4FF] hover:text-[#0041B6] dark:border-white/15 dark:bg-white/10 dark:text-white dark:backdrop-blur dark:hover:bg-white/18"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1.5">
        {availableItems.map((item) => {
          const isActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          const Icon = item.icon

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={collapsed ? t(item.labelKey) : undefined}
              className={clsx(
                'group flex w-full items-center text-[15px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-150',
                collapsed
                  ? 'mx-auto h-12 w-12 justify-center rounded-2xl px-0'
                  : 'min-h-11 gap-3 rounded-[18px] px-3.5 py-2.5',
                isActive
                  ? 'border border-[#D7E5FF] bg-[#EEF4FF] text-[#0B4FCF] shadow-[0_4px_12px_rgba(13,62,167,0.07)] dark:border-[#35558E] dark:bg-[#18325B] dark:text-white'
                  : 'border border-transparent text-slate-600 hover:bg-[#F4F7FB] hover:text-slate-900 dark:text-[#C9D8F7] dark:hover:!border-[#29497B] dark:hover:!bg-[#172744] dark:hover:text-white',
              )}
            >
              <span
                className={clsx(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive
                    ? collapsed
                      ? 'bg-transparent text-[#0B4FCF] dark:text-white'
                      : 'bg-[#DCE9FF] text-[#0B4FCF] dark:bg-[#23457A] dark:text-white'
                    : 'bg-transparent text-slate-500 group-hover:text-[#0B4FCF] dark:text-[#9EB4E2] dark:group-hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
              </span>
              {!collapsed ? <span className="min-w-0 truncate">{t(item.labelKey)}</span> : null}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default function Sidebar() {
  const {
    isSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarOpen,
    toggleSidebarCollapsed,
  } = useErm()
  const { hasPermission } = useAuth()
  const { t } = useI18n()
  const asideRef = useRef(null)

  const availableItems = useMemo(
    () => navItems.filter((item) => hasPermission(item.permission)),
    [hasPermission],
  )

  useEffect(() => {
    if (!isSidebarOpen) {
      document.body.style.removeProperty('overflow')
      return undefined
    }

    document.body.style.overflow = 'hidden'
    const panel = asideRef.current
    const focusable = panel?.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable?.[0]
    const last = focusable?.[focusable.length - 1]
    const previousActive = document.activeElement
    window.setTimeout(() => first?.focus(), 40)

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false)
        return
      }

      if (event.key !== 'Tab' || !focusable?.length) {
        return
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.removeProperty('overflow')
      window.removeEventListener('keydown', onKeyDown)
      previousActive?.focus?.()
    }
  }, [isSidebarOpen, setIsSidebarOpen])

  return (
    <>
      <aside
        className={clsx(
          'hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:transition-[width] lg:duration-200 lg:ease-out',
          isSidebarCollapsed ? 'lg:w-[92px]' : 'lg:w-[288px]',
        )}
      >
        <SidebarPanel
          availableItems={availableItems}
          collapsed={isSidebarCollapsed}
          onNavigate={undefined}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      </aside>

      <AnimatePresence>
        {isSidebarOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-[#091220]/40 backdrop-blur-[5px] lg:hidden"
              aria-label={t('common.close')}
              onClick={() => setIsSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            />

            <motion.aside
              ref={asideRef}
              role="dialog"
              aria-modal="true"
              className="fixed inset-y-0 left-0 z-50 w-[min(88vw,340px)] outline-none lg:hidden"
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <SidebarPanel
                availableItems={availableItems}
                collapsed={false}
                onNavigate={() => setIsSidebarOpen(false)}
                showCloseButton
                onClose={() => setIsSidebarOpen(false)}
                onToggleCollapsed={undefined}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
