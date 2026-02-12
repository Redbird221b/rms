import { Navigate, createBrowserRouter } from 'react-router-dom'
import AppShell from './layout/AppShell'
import Admin from '../pages/Admin'
import Committee from '../pages/Committee'
import CreateRisk from '../pages/CreateRisk'
import Dashboard from '../pages/Dashboard'
import RiskDetails from '../pages/RiskDetails'
import RisksList from '../pages/RisksList'
import ReviewQueue from '../pages/ReviewQueue'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'risks', element: <RisksList /> },
      { path: 'risks/:id', element: <RiskDetails /> },
      { path: 'queue', element: <ReviewQueue /> },
      { path: 'committee', element: <Committee /> },
      { path: 'create', element: <CreateRisk /> },
      { path: 'admin', element: <Admin /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
