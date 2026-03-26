import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../app/context/AuthContext'
import { useI18n } from '../app/context/I18nContext'

const transition = { duration: 0.18, ease: 'easeOut' }

export default function Login() {
  const { accounts, login } = useAuth()
  const { t } = useI18n()
  const defaultAccount = accounts[0] ?? null
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccount?.id ?? null)
  const [isProfilesDragging, setIsProfilesDragging] = useState(false)
  const [credentials, setCredentials] = useState(() => ({
    username: defaultAccount?.username ?? '',
    password: defaultAccount?.password ?? '',
  }))
  const [error, setError] = useState('')
  const profilesRailRef = useRef(null)
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    dragStarted: false,
    suppressClick: false,
    pressedAccountId: null,
  })

  const handleChange = (field) => (event) => {
    setCredentials((current) => ({ ...current, [field]: event.target.value }))
    setError('')
  }

  const handleSelectAccount = (account) => {
    if (!account) {
      return
    }
    setSelectedAccountId(account.id)
    setCredentials({
      username: account.username,
      password: account.password,
    })
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const result = login(credentials)
    if (!result.ok) {
      setError(t('auth.invalidCredentials'))
    }
  }

  const handleProfilesPointerDown = (event) => {
    if (event.pointerType !== 'mouse') {
      return
    }

    const rail = profilesRailRef.current
    if (!rail) {
      return
    }

    dragStateRef.current = {
      ...dragStateRef.current,
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: rail.scrollLeft,
      dragStarted: false,
      suppressClick: false,
      pressedAccountId: event.target.closest('[data-account-id]')?.dataset.accountId ?? null,
    }

    try {
      rail.setPointerCapture(event.pointerId)
    } catch {
      // Ignore if pointer capture is not available for this browser/input.
    }
  }

  const handleProfilesPointerMove = (event) => {
    const state = dragStateRef.current
    if (!state.active || event.pointerType !== 'mouse') {
      return
    }

    const rail = profilesRailRef.current
    if (!rail) {
      return
    }

    const deltaX = event.clientX - state.startX
    if (Math.abs(deltaX) > 8) {
      state.dragStarted = true
      state.suppressClick = true
      setIsProfilesDragging(true)
    }

    if (!state.dragStarted) {
      return
    }

    rail.scrollLeft = state.startScrollLeft - deltaX
  }

  const finishProfilesDrag = (event) => {
    const state = dragStateRef.current
    if (!state.active) {
      return
    }

    state.active = false
    const shouldSelectAccount = !state.dragStarted && state.pressedAccountId
    const pressedAccountId = state.pressedAccountId
    setIsProfilesDragging(false)

    const rail = profilesRailRef.current
    if (rail && state.pointerId != null) {
      try {
        rail.releasePointerCapture(state.pointerId)
      } catch {
        // Ignore if capture was already lost.
      }
    }

    dragStateRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
      dragStarted: false,
      suppressClick: false,
      pressedAccountId: null,
    }

    if (shouldSelectAccount) {
      handleSelectAccount(accounts.find((account) => account.id === pressedAccountId) ?? null)
    }
  }

  const handleProfilesWheel = (event) => {
    const rail = profilesRailRef.current
    if (!rail) {
      return
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (delta === 0) {
      return
    }

    event.preventDefault()
    rail.scrollLeft += delta
  }

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-8 sm:items-center sm:px-6">
      <div className="w-full max-w-[460px]">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="panel p-5 sm:p-6"
        >
          <h1 className="text-center text-xl font-semibold text-slate-950 dark:text-white">
            {t('auth.loginShortTitle')}
          </h1>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t('auth.username')}
              </span>
              <input
                autoComplete="username"
                className="input-field"
                value={credentials.username}
                onChange={handleChange('username')}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t('auth.password')}
              </span>
              <input
                type="password"
                autoComplete="current-password"
                className="input-field"
                value={credentials.password}
                onChange={handleChange('password')}
              />
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full">
              <span>{t('auth.signIn')}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </form>
        </motion.section>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t('auth.demoUsers')}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('auth.demoUsersHint')}
              </p>
            </div>
          </div>

          <div
            ref={profilesRailRef}
            className={[
              'scroll-panel overflow-x-auto pb-1 select-none',
              isProfilesDragging ? 'cursor-grabbing' : 'cursor-grab',
            ].join(' ')}
            onPointerDown={handleProfilesPointerDown}
            onPointerMove={handleProfilesPointerMove}
            onPointerUp={finishProfilesDrag}
            onPointerCancel={finishProfilesDrag}
            onPointerLeave={finishProfilesDrag}
            onWheel={handleProfilesWheel}
          >
            <div className="flex min-w-max gap-2 pr-1">
              {accounts.map((account) => {
                const isSelected = account.id === selectedAccountId
                return (
                  <button
                    key={account.id}
                    type="button"
                    data-account-id={account.id}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleSelectAccount(account)
                      }
                    }}
                    className={[
                      'w-56 shrink-0 rounded-lg border px-3 py-3 text-left transition-colors',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                      isSelected
                        ? 'border-[color:var(--brand-blue)] bg-[rgba(0,65,182,0.12)] text-slate-950 outline-[color:var(--brand-blue)] dark:border-[#5a84ff] dark:bg-[rgba(90,132,255,0.18)] dark:text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-800 outline-[color:var(--brand-blue)] hover:border-slate-300 hover:bg-white dark:border-[color:var(--brand-dark-border)] dark:bg-[color:var(--brand-dark-surface-2)] dark:text-slate-100 dark:hover:border-[color:var(--brand-dark-border-strong)] dark:hover:bg-[#17325d]',
                    ].join(' ')}
                  >
                    <div className="text-sm font-semibold leading-5">{account.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {account.role}
                    </div>
                    <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                      {account.department}
                    </div>
                    {account.demoFocusKey ? (
                      <div className="mt-2 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
                        {t(account.demoFocusKey)}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
