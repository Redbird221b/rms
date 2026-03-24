import { AnimatePresence, motion } from 'framer-motion'
import {
  ClipboardList,
  LayoutDashboard,
  PanelLeftOpen,
  PlusSquare,
  Settings2,
  ShieldAlert,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
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

const INTRO_HINT_DURATION_MS = 2850
const HOVER_HINT_DURATION_MS = 3000
const INTRO_PULSE_DURATION = 2.8
const INTRO_PULSE_SCALE = [1, 1.04, 1, 1.04, 1, 1.04, 1]

function EdgeMenuButton({
  side,
  y = '50%',
  showLabel,
  pulse,
  intro = false,
  onClick,
  ariaLabel,
  label,
  subtitle,
}) {
  return (
    <motion.button
      type="button"
      initial={
        intro
          ? {
              opacity: 0,
              scale: 0.94,
              x: side === 'left' ? -18 : 18,
            }
          : { opacity: 0, scale: 0.92 }
      }
      animate={pulse ? { opacity: 1, scale: INTRO_PULSE_SCALE } : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={
        pulse
          ? { duration: INTRO_PULSE_DURATION, ease: 'easeInOut' }
          : { duration: 0.16, ease: 'easeOut' }
      }
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(
        'fixed z-30 hidden items-center gap-2 border shadow-lg backdrop-blur md:flex',
        intro
          ? 'h-14 min-w-[208px] rounded-[18px] px-4 py-2 ring-1 ring-white/15 shadow-[0_16px_36px_rgba(0,65,182,0.32)] dark:shadow-[0_16px_36px_rgba(219,67,0,0.26)]'
          : showLabel
            ? 'h-12 rounded-full px-4 text-sm font-semibold'
            : 'h-12 w-12 justify-center rounded-full',
        'border-[#BFD0F5] bg-[#0041B6] text-white hover:bg-[#003693]',
        'dark:border-[#365389] dark:bg-[#DB4300] dark:text-white dark:hover:bg-[#b53700]',
        intro
          ? side === 'left'
            ? 'left-0 -translate-x-[10%]'
            : 'right-0 translate-x-[10%]'
          : side === 'left'
            ? 'left-3'
            : 'right-3',
      )}
      style={{ top: y }}
    >
      {intro ? (
        <>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
            <PanelLeftOpen className="h-4 w-4" />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-sm font-semibold leading-4">{label}</span>
            <span className="mt-0.5 block text-[11px] font-medium leading-4 text-white/85">
              {subtitle}
            </span>
          </span>
        </>
      ) : (
        <PanelLeftOpen className="h-4 w-4 shrink-0" />
      )}
    </motion.button>
  )
}

function SidebarContent({ availableItems, onNavigate }) {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <div className="flex h-full flex-col border-r border-[#1E3767] bg-[linear-gradient(180deg,#10244B_0%,#0D1C36_65%,#091625_100%)] px-4 py-5 text-white shadow-xl">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0041B6] shadow-sm">
          ER
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{t('nav.portalTitle')}</p>
          <p className="truncate text-xs text-blue-100/80">{t('nav.portalSubtitle')}</p>
        </div>
      </div>

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
                'group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-[#DB4300] text-white shadow-sm'
                  : 'text-blue-50/88 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default function Sidebar() {
  const { isSidebarOpen, setIsSidebarOpen, sidebarSide, openSidebar } = useErm()
  const { hasPermission } = useAuth()
  const { t } = useI18n()
  const asideRef = useRef(null)
  const introTimerRef = useRef(null)
  const introSeenRef = useRef(false)
  const hoverButtonTimerRef = useRef(null)
  const lastNearEdgeRef = useRef(false)
  const hoverButtonVisibleRef = useRef(false)
  const [showIntroButtons, setShowIntroButtons] = useState(true)
  const [hoverButton, setHoverButton] = useState({
    visible: false,
    side: 'left',
    y: 180,
  })

  const availableItems = useMemo(
    () => navItems.filter((item) => hasPermission(item.permission)),
    [hasPermission],
  )

  useEffect(() => {
    if (isSidebarOpen) {
      window.clearTimeout(introTimerRef.current)
      window.clearTimeout(hoverButtonTimerRef.current)
      lastNearEdgeRef.current = false
      hoverButtonVisibleRef.current = false
      setShowIntroButtons(false)
      setHoverButton((current) => ({ ...current, visible: false }))
      introSeenRef.current = true
      return undefined
    }

    if (introSeenRef.current) {
      setShowIntroButtons(false)
      return undefined
    }

    setShowIntroButtons(true)
    window.clearTimeout(introTimerRef.current)
    introTimerRef.current = window.setTimeout(() => {
      setShowIntroButtons(false)
      introSeenRef.current = true
    }, INTRO_HINT_DURATION_MS)

    return () => {
      window.clearTimeout(introTimerRef.current)
    }
  }, [isSidebarOpen])

  useEffect(() => {
    if (isSidebarOpen) {
      window.clearTimeout(hoverButtonTimerRef.current)
      hoverButtonVisibleRef.current = false
      lastNearEdgeRef.current = false
      setHoverButton((current) => ({ ...current, visible: false }))
      return undefined
    }

    const onMove = (event) => {
      if (window.innerWidth < 1024 || showIntroButtons) {
        return
      }

      const threshold = 32
      const nearLeft = event.clientX <= threshold
      const nearRight = window.innerWidth - event.clientX <= threshold
      const isNearEdge = nearLeft || nearRight

      if (!isNearEdge) {
        lastNearEdgeRef.current = false
        return
      }

      if (lastNearEdgeRef.current || hoverButtonVisibleRef.current) {
        lastNearEdgeRef.current = true
        return
      }

      lastNearEdgeRef.current = true
      const side = nearLeft ? 'left' : 'right'
      const y = Math.max(96, Math.min(window.innerHeight - 96, event.clientY))
      hoverButtonVisibleRef.current = true
      setHoverButton({ visible: true, side, y })
      window.clearTimeout(hoverButtonTimerRef.current)
      hoverButtonTimerRef.current = window.setTimeout(() => {
        hoverButtonVisibleRef.current = false
        setHoverButton((current) => ({ ...current, visible: false }))
      }, HOVER_HINT_DURATION_MS)
    }

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.clearTimeout(hoverButtonTimerRef.current)
    }
  }, [isSidebarOpen, showIntroButtons])

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
      <AnimatePresence>
        {showIntroButtons ? (
          <>
            <EdgeMenuButton
              side="left"
              showLabel
              pulse
              intro
              onClick={() => openSidebar('left')}
              ariaLabel={t('top.openNavigation')}
              label={t('sidebar.menu')}
              subtitle={t('sidebar.menuHint')}
            />
            <EdgeMenuButton
              side="right"
              showLabel
              pulse
              intro
              onClick={() => openSidebar('right')}
              ariaLabel={t('top.openNavigation')}
              label={t('sidebar.menu')}
              subtitle={t('sidebar.menuHint')}
            />
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {hoverButton.visible ? (
          <EdgeMenuButton
            side={hoverButton.side}
            y={hoverButton.y}
            onClick={() => openSidebar(hoverButton.side)}
            ariaLabel={t('top.openNavigation')}
            showLabel={false}
            pulse={false}
            intro={false}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-[#091220]/40 backdrop-blur-[5px]"
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
              className={clsx(
                'fixed inset-y-0 z-50 w-[min(88vw,340px)] outline-none',
                sidebarSide === 'right' ? 'right-0' : 'left-0',
              )}
              initial={{ x: sidebarSide === 'right' ? 30 : -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: sidebarSide === 'right' ? 26 : -26, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="absolute right-3 top-3 z-10">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/18"
                  aria-label={t('common.close')}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <SidebarContent
                availableItems={availableItems}
                onNavigate={() => setIsSidebarOpen(false)}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
