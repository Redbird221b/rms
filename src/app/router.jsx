import { Suspense, lazy } from 'react'
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useI18n } from './context/I18nContext'
import { PERMISSIONS } from '../lib/access'

const AppShell = lazy(() => import('./layout/AppShell'))
const AccessDenied = lazy(() => import('../pages/AccessDenied'))
const Admin = lazy(() => import('../pages/Admin'))
const Committee = lazy(() => import('../pages/Committee'))
const CreateRisk = lazy(() => import('../pages/CreateRisk'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const EditRisk = lazy(() => import('../pages/EditRisk'))
const Login = lazy(() => import('../pages/Login'))
const RiskDetails = lazy(() => import('../pages/RiskDetails'))
const RisksList = lazy(() => import('../pages/RisksList'))
const ReviewQueue = lazy(() => import('../pages/ReviewQueue'))

function AuthGateFallback() {
  const { t } = useI18n()

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="panel w-full max-w-md p-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.checkingSession')}</p>
      </section>
    </main>
  )
}

function RouteChunkFallback({ fullscreen = false }) {
  const { t } = useI18n()

  if (fullscreen) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="panel w-full max-w-md p-6 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loadingPage')}</p>
        </section>
      </main>
    )
  }

  return (
    <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">
      {t('common.loadingPage')}
    </section>
  )
}

function withRouteSuspense(children, { fullscreen = false } = {}) {
  return (
    <Suspense fallback={<RouteChunkFallback fullscreen={fullscreen} />}>
      {children}
    </Suspense>
  )
}

function ProtectedShell() {
  const location = useLocation()
  const { isAuthenticated, isReady } = useAuth()

  if (!isReady) {
    return <AuthGateFallback />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return withRouteSuspense(<AppShell />, { fullscreen: true })
}

function PublicOnly({ children }) {
  const { isAuthenticated, isReady } = useAuth()

  if (!isReady) {
    return <AuthGateFallback />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function PermissionGate({ permission, children }) {
  const { hasPermission } = useAuth()

  if (!hasPermission(permission)) {
    return <Navigate to="/access-denied" replace />
  }

  return children
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnly>
        {withRouteSuspense(<Login />, { fullscreen: true })}
      </PublicOnly>
    ),
  },
  {
    path: '/',
    element: <ProtectedShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <PermissionGate permission={PERMISSIONS.VIEW_DASHBOARD}>
            {withRouteSuspense(<Dashboard />)}
          </PermissionGate>
        ),
      },
      {
        path: 'risks',
        element: (
          <PermissionGate permission={PERMISSIONS.VIEW_RISKS}>
            {withRouteSuspense(<RisksList />)}
          </PermissionGate>
        ),
      },
      {
        path: 'risks/:id',
        element: (
          <PermissionGate permission={PERMISSIONS.VIEW_RISKS}>
            {withRouteSuspense(<RiskDetails />)}
          </PermissionGate>
        ),
      },
      {
        path: 'risks/:id/edit',
        element: (
          <PermissionGate permission={PERMISSIONS.VIEW_RISKS}>
            {withRouteSuspense(<EditRisk />)}
          </PermissionGate>
        ),
      },
      {
        path: 'queue',
        element: (
          <PermissionGate permission={PERMISSIONS.REVIEW_QUEUE_ACTIONS}>
            {withRouteSuspense(<ReviewQueue />)}
          </PermissionGate>
        ),
      },
      {
        path: 'committee',
        element: (
          <PermissionGate permission={PERMISSIONS.COMMITTEE_DECIDE}>
            {withRouteSuspense(<Committee />)}
          </PermissionGate>
        ),
      },
      {
        path: 'create',
        element: (
          <PermissionGate permission={PERMISSIONS.CREATE_RISK}>
            {withRouteSuspense(<CreateRisk />)}
          </PermissionGate>
        ),
      },
      {
        path: 'admin',
        element: (
          <PermissionGate permission={PERMISSIONS.MANAGE_REFERENCE_DATA}>
            {withRouteSuspense(<Admin />)}
          </PermissionGate>
        ),
      },
      { path: 'access-denied', element: withRouteSuspense(<AccessDenied />) },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
