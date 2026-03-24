import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ErmProvider } from './context/ErmContext'
import { I18nProvider } from './context/I18nContext'
import { router } from './router'
import ToastContainer from '../components/common/ToastContainer'

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ErmProvider>
          <RouterProvider router={router} />
          <ToastContainer />
        </ErmProvider>
      </AuthProvider>
    </I18nProvider>
  )
}
