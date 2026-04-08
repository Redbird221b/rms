import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Building2, ChevronDown, KeyRound, LogOut, ShieldCheck, UserCircle2 } from 'lucide-react'
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

  const translatedPrimaryRole = t(`auth.role.${currentUser.accessRole}`)
  const roleChips = (currentUser.accessRoles ?? [currentUser.accessRole]).map((role) => ({
    key: role,
    label: t(`auth.role.${role}`),
  }))
  const departmentLabel = currentUser.department || t('profile.departmentEmpty')
  const positionLabel =
    currentUser.role && currentUser.role !== translatedPrimaryRole
      ? currentUser.role
      : t('profile.positionFallback')
  const profileFacts = [
    {
      key: 'access',
      icon: ShieldCheck,
      label: t('profile.accessLabel'),
      value: translatedPrimaryRole,
    },
    {
      key: 'position',
      icon: BadgeCheck,
      label: t('profile.positionLabel'),
      value: positionLabel,
    },
    {
      key: 'username',
      icon: KeyRound,
      label: t('profile.usernameLabel'),
      value: currentUser.username || currentUser.email,
    },
    {
      key: 'department',
      icon: Building2,
      label: t('profile.departmentLabel'),
      value: departmentLabel,
    },
  ]

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
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,392px)] rounded-3xl border border-[#D9D9D9] bg-white p-3 shadow-xl dark:border-[#2F4878] dark:bg-[#13264A]"
          >
            <div className="overflow-hidden rounded-2xl border border-[#E5EAF2] bg-[#F8FAFD] dark:border-[#274272] dark:bg-[#10203D]">
              <div className="border-b border-[#E5EAF2] bg-[linear-gradient(135deg,#F7FAFF_0%,#EEF4FF_100%)] px-4 py-4 dark:border-[#274272] dark:bg-[linear-gradient(135deg,#132A52_0%,#10203D_100%)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0041B6] shadow-[0_10px_24px_rgba(0,65,182,0.12)] ring-1 ring-[#D7E4FF] dark:bg-[#16305C] dark:text-[#D7E4FF] dark:ring-[#2F4878] dark:shadow-none">
                    <UserCircle2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {currentUser.name}
                      </p>
                      <span className="inline-flex items-center rounded-full bg-[#DB4300] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        {translatedPrimaryRole}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.email}
                    </p>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-[#8FA6D5]">
                      {t('profile.menuTitle')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 px-4 py-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {profileFacts.map((fact) => {
                    const Icon = fact.icon

                    return (
                      <div
                        key={fact.key}
                        className="flex min-h-[98px] flex-col rounded-2xl border border-[#E5EAF2] bg-white px-3 py-3 dark:border-[#274272] dark:bg-[#13264A]"
                      >
                        <div className="flex items-start gap-2">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#F4F8FF] text-[#35588F] ring-1 ring-[#D9E3F2] dark:bg-[#102342] dark:text-[#D6E4FF] dark:ring-[#35548A]">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-[10.5px] font-semibold leading-[1.2] text-slate-500 dark:text-[#9AB1DE]">
                            {fact.label}
                          </p>
                        </div>
                        <div className="mt-auto pt-3">
                          <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
                            {fact.value}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {roleChips.length > 1 ? (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#8FA6D5]">
                      {t('profile.rolesLabel')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {roleChips.map((role) => (
                        <span
                          key={role.key}
                          className="inline-flex rounded-full border border-[#D9E3F2] bg-[#F4F8FF] px-2.5 py-1 text-[11px] font-medium text-[#35588F] dark:border-[#35548A] dark:bg-[#102342] dark:text-[#D6E4FF]"
                        >
                          {role.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#F2C8B6] bg-[#FFF5F0] px-4 py-2.5 text-sm font-medium text-[#A33A09] transition-colors hover:bg-[#FFE9DE] dark:border-[#6C3C27] dark:bg-[#2A1B17] dark:text-[#FFC4A7] dark:hover:bg-[#34211C]"
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
