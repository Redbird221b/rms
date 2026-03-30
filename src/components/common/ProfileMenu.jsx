import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../app/context/AuthContext'
import { useI18n } from '../../app/context/I18nContext'

export default function ProfileMenu() {
  const { currentUser, logout } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!currentUser) {
    return null
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 max-w-[220px] items-center gap-2 rounded-xl border border-[#D9D9D9] bg-white px-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-[#F6F8FC] dark:border-[#274272] dark:bg-[#132547] dark:text-[#E5ECFF] dark:hover:bg-[#1A2F59]"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DB4300] text-[11px] font-semibold text-white">
          {currentUser.initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium leading-4">{currentUser.name}</span>
          <span className="block truncate text-[11px] leading-4 text-slate-500 dark:text-[#9EB4E2]">
            {currentUser.role}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,320px)] rounded-3xl border border-[#D9D9D9] bg-white p-3 shadow-xl dark:border-[#2F4878] dark:bg-[#13264A]"
          >
            <div className="rounded-2xl bg-[#F6F8FC] p-3 dark:bg-[#10203D]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8EFFF] text-[#0041B6] dark:bg-[#18315D] dark:text-[#C7D8FF]">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {currentUser.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {currentUser.email}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {currentUser.role}
                  </p>
                  <p className="mt-2 inline-flex rounded-full bg-[#FFF1EA] px-2.5 py-1 text-[11px] font-medium text-[#B53700] dark:bg-[#2B1A16] dark:text-[#FFBE9F]">
                    {t(`auth.role.${currentUser.accessRole}`)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className="btn-secondary justify-start gap-2"
                onClick={() => {
                  setOpen(false)
                  void logout()
                }}
              >
                <LogOut className="h-4 w-4" />
                {t('auth.logout')}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
