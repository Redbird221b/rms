import { AnimatePresence, motion } from 'framer-motion'
import {
  ClipboardList,
  LayoutDashboard,
  PlusSquare,
  Settings2,
  ShieldAlert,
  UsersRound,
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

function LogoLink({ expanded = false, onClick }) {
  return (
    <Link
      to="/dashboard"
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      className={clsx(
        'group flex items-center transition-opacity hover:opacity-95',
        expanded ? 'gap-3' : 'justify-center',
      )}
      title={!expanded ? 'UZCARD' : undefined}
    >
      <img
        src="/uzcard-logo.png"
        alt="UZCARD"
        className={clsx(
          'shrink-0 object-contain',
          expanded ? 'h-11 w-auto max-w-[132px]' : 'h-11 w-auto max-w-[48px]',
        )}
      />
      {expanded ? (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-black uppercase tracking-[0.22em] text-white">
            UZCARD
          </p>
          <p className="truncate text-[12px] text-[#91A9D8]">Корпоративные риски</p>
        </div>
      ) : null}
    </Link>
  )
}

function RailNav({ availableItems, onNavigate }) {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <nav className="flex flex-col items-center gap-3">
      {availableItems.map((item) => {
        const isActive =
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        const Icon = item.icon

        return (
          <Link
            key={item.path}
            to={item.path}
            title={t(item.labelKey)}
            onClick={(event) => {
              event.stopPropagation()
              onNavigate?.()
            }}
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors duration-150',
              isActive
                ? 'border-[#3B68B4] bg-[#17315E] text-white'
                : 'border-transparent text-[#A9B9DC] hover:border-[#29497B] hover:bg-[#172744] hover:text-white',
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        )
      })}
    </nav>
  )
}

function PanelNav({ availableItems, onNavigate }) {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <nav className="space-y-1.5">
      {availableItems.map((item) => {
        const isActive =
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        const Icon = item.icon

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={clsx(
              'group flex min-h-12 items-center gap-3 rounded-[18px] border px-3.5 py-2.5 text-[15px] font-semibold transition-colors duration-150',
              isActive
                ? 'border-[#3B68B4] bg-[#1F3E74] text-white'
                : 'border-transparent text-[#D2DDF5] hover:border-[#29497B] hover:bg-[#172744] hover:text-white',
            )}
          >
            <span
              className={clsx(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-[#A9B9DC] group-hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 truncate">{t(item.labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default function Sidebar() {
  const { isSidebarOpen, setIsSidebarOpen, openSidebar } = useErm()
  const { hasPermission } = useAuth()
  const { t } = useI18n()
  const panelRef = useRef(null)

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
    const panel = panelRef.current
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
        className="hidden lg:flex lg:h-screen lg:w-[88px] lg:shrink-0 lg:flex-col lg:items-center lg:border-r lg:border-[#243E71] lg:bg-[linear-gradient(180deg,#12264A_0%,#101F3E_100%)] lg:px-3 lg:py-4"
        onClick={() => openSidebar()}
      >
        <div className="w-full">
          <LogoLink />
        </div>

        <div className="my-5 h-px w-10 bg-[#27406F]" />

        <div className="w-full">
          <RailNav availableItems={availableItems} />
        </div>

        <div className="mt-auto min-h-8 w-full" />
      </aside>

      <AnimatePresence>
        {isSidebarOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-[#091220]/36 backdrop-blur-[8px]"
              aria-label={t('common.close')}
              onClick={() => setIsSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            />

            <motion.aside
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              className="fixed inset-y-0 left-0 z-50 w-[288px] border-r border-[#243E71] bg-[linear-gradient(180deg,#12264A_0%,#101F3E_100%)] px-5 py-5 text-white shadow-[0_24px_48px_rgba(5,12,26,0.32)] outline-none"
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="flex h-full flex-col">
                <div className="border-b border-[#27406F] pb-5">
                  <LogoLink expanded onClick={() => setIsSidebarOpen(false)} />
                </div>

                <div className="mt-5 flex-1">
                  <PanelNav
                    availableItems={availableItems}
                    onNavigate={() => setIsSidebarOpen(false)}
                  />
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
