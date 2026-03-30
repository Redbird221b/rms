import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useI18n } from './context/I18nContext'
import AppShell from './layout/AppShell'
import AccessDenied from '../pages/AccessDenied'
import Admin from '../pages/Admin'
import Committee from '../pages/Committee'
import CreateRisk from '../pages/CreateRisk'
import Dashboard from '../pages/Dashboard'
import EditRisk from '../pages/EditRisk'
import Login from '../pages/Login'
import RiskDetails from '../pages/RiskDetails'
import RisksList from '../pages/RisksList'
import ReviewQueue from '../pages/ReviewQueue'
import { PERMISSIONS } from '../lib/access'

function AuthGateFallback() {
  const { language } = useI18n()
  const title =
    language === 'uz'
      ? 'Sessiya tekshirilmoqda...'
      : language === 'en'
        ? 'Checking your session...'
        : 'Проверяем сессию...'

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="panel w-full max-w-md p-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      </section>
    </main>
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

  return <AppShell />
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
        <Login />
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
            <Dashboard />
          </PermissionGate>
        ),
      },
      {
        path: 'risks',
        element: (
          <PermissionGate permission={PERMISSIONS.VIEW_RISKS}>
            <RisksList />
          </PermissionGate>
        ),
      },
      {
        path: 'risks/:id',
        element: (
          <PermissionGate permission={PERMISSIONS.VIEW_RISKS}>
            <RiskDetails />
          </PermissionGate>
        ),
      },
      {
        path: 'risks/:id/edit',
        element: (
          <PermissionGate permission={PERMISSIONS.VIEW_RISKS}>
            <EditRisk />
          </PermissionGate>
        ),
      },
      {
        path: 'queue',
        element: (
          <PermissionGate permission={PERMISSIONS.REVIEW_QUEUE_ACTIONS}>
            <ReviewQueue />
          </PermissionGate>
        ),
      },
      {
        path: 'committee',
        element: (
          <PermissionGate permission={PERMISSIONS.COMMITTEE_DECIDE}>
            <Committee />
          </PermissionGate>
        ),
      },
      {
        path: 'create',
        element: (
          <PermissionGate permission={PERMISSIONS.CREATE_RISK}>
            <CreateRisk />
          </PermissionGate>
        ),
      },
      {
        path: 'admin',
        element: (
          <PermissionGate permission={PERMISSIONS.MANAGE_REFERENCE_DATA}>
            <Admin />
          </PermissionGate>
        ),
      },
      { path: 'access-denied', element: <AccessDenied /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
