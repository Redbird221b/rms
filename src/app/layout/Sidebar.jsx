import { AnimatePresence, motion } from 'framer-motion'
import {
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
}) {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <div
      className={clsx(
        'flex h-full flex-col border-r border-[#1E3767] bg-[linear-gradient(180deg,#10244B_0%,#0D1C36_65%,#091625_100%)] text-white shadow-xl',
        collapsed ? 'items-center px-3 py-5' : 'px-4 py-5',
      )}
    >
      <div
        className={clsx(
          'mb-8 flex w-full items-start',
          collapsed ? 'flex-col items-center gap-3' : 'justify-between gap-3',
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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D74D1_0%,#0041B6_55%,#002A76_100%)] text-white shadow-[0_10px_24px_rgba(0,65,182,0.35)] ring-1 ring-white/10">
            <span className="text-[13px] font-black tracking-[0.22em]">UZ</span>
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-black uppercase tracking-[0.28em] text-white">
                UZCARD
              </p>
              <p className="truncate text-xs text-blue-100/80">{t('nav.portalTitle')}</p>
            </div>
          ) : null}
        </Link>

        {showCloseButton ? (
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/18"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2">
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
                'group flex w-full min-h-12 items-center rounded-2xl text-sm font-medium transition-colors duration-150',
                collapsed
                  ? 'justify-center px-0'
                  : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-[#DB4300] text-white shadow-sm'
                  : 'text-blue-50/88 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span className="min-w-0 truncate">{t(item.labelKey)}</span> : null}
            </Link>
          )
        })}
      </nav>

      {!collapsed ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-blue-100/78">
          <p className="font-semibold uppercase tracking-[0.22em] text-white/85">UZCARD</p>
          <p className="mt-1 leading-5">{t('nav.portalSubtitle')}</p>
        </div>
      ) : null}
    </div>
  )
}

export default function Sidebar() {
  const {
    isSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarOpen,
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
          isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72',
        )}
      >
        <SidebarPanel
          availableItems={availableItems}
          collapsed={isSidebarCollapsed}
          onNavigate={undefined}
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
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
