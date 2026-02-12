import { RouterProvider } from 'react-router-dom'
import { ErmProvider } from './context/ErmContext'
import { I18nProvider } from './context/I18nContext'
import { router } from './router'
import ToastContainer from '../components/common/ToastContainer'

export default function App() {
  return (
    <I18nProvider>
      <ErmProvider>
        <RouterProvider router={router} />
        <ToastContainer />
      </ErmProvider>
    </I18nProvider>
  )
}
