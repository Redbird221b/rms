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
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useErm } from '../context/ErmContext'
import { useI18n } from '../context/I18nContext'

const navItems = [
  { labelKey: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.riskRegister', path: '/risks', icon: ShieldAlert },
  { labelKey: 'nav.reviewQueue', path: '/queue', icon: ClipboardList },
  { labelKey: 'nav.committee', path: '/committee', icon: UsersRound },
  { labelKey: 'nav.createRisk', path: '/create', icon: PlusSquare },
  { labelKey: 'nav.admin', path: '/admin', icon: Settings2 },
]

function SidebarContent({ onNavigate }) {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <div className="h-full border-r border-[#003899] bg-gradient-to-b from-[#0041B6] to-[#003899] px-4 py-5 text-white shadow-sm dark:border-[#274272] dark:from-[#112448] dark:to-[#0D1A34]">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0041B6] shadow-sm dark:bg-[#1B3562] dark:text-[#D5E3FF]">
          ER
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{t('nav.portalTitle')}</p>
          <p className="text-xs text-blue-100/90 dark:text-[#B7C9EE]">{t('nav.portalSubtitle')}</p>
        </div>
      </div>
      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={clsx(
                'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-[#DB4300] text-white shadow-sm dark:bg-[#C34A16]'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white dark:text-[#CAD8F5] dark:hover:bg-white/8',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default function Sidebar() {
  const { isSidebarOpen, setIsSidebarOpen } = useErm()
  const { t } = useI18n()

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 lg:block">
        <SidebarContent />
      </aside>
      <AnimatePresence>
        {isSidebarOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-slate-900/35 lg:hidden"
              aria-label={t('common.close')}
              onClick={() => setIsSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="absolute right-2 top-2">
                <button
                  type="button"
                  className="rounded-md p-1.5 text-blue-100 hover:bg-white/15 hover:text-white dark:text-[#CAD8F5] dark:hover:bg-white/10"
                  aria-label={t('common.close')}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent onNavigate={() => setIsSidebarOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
