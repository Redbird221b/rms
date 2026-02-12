import { AnimatePresence, motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import GlobalFilterBar from '../../components/common/GlobalFilterBar'
import { useErm } from '../context/ErmContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell() {
  const location = useLocation()
  const { setIsSidebarOpen } = useErm()

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 antialiased transition-colors dark:bg-[#0D162A] dark:text-slate-100">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6 lg:px-8">
          <GlobalFilterBar />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
