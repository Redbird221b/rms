import { AnimatePresence, motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import GlobalFilterBar from '../../components/common/GlobalFilterBar'
import { useErm } from '../context/ErmContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell() {
  const location = useLocation()
  const { isSidebarOpen, openSidebar } = useErm()
  const showGlobalFilters = ['/dashboard', '/risks', '/queue'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 antialiased transition-colors dark:bg-[#0D162A] dark:text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 sm:px-6 lg:px-8 xl:px-10">
            <Topbar onMenuClick={openSidebar} />
            <main
              aria-hidden={isSidebarOpen}
              className="flex flex-1 flex-col pb-6 pt-3 sm:pb-8 sm:pt-4"
            >
              {showGlobalFilters ? <GlobalFilterBar /> : null}
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex-1"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
