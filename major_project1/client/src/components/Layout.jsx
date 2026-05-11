    import { Outlet, Link, useLocation } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useEffect } from 'react'

const Layout = () => {
  const location = useLocation()
  const { hasNewAlert, clearNewAlert } = useSocket()

  useEffect(() => {
    if (location.pathname === '/alerts') clearNewAlert?.()
  }, [location.pathname, clearNewAlert])

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { path: '/map', label: 'Map', icon: 'fa-map-location-dot' },
    { path: '/alerts', label: 'Alerts', icon: 'fa-bell' },
    { path: '/sos', label: 'SOS', icon: 'fa-life-ring' },
    { path: '/analytics', label: 'Analytics', icon: 'fa-chart-pie' },
    { path: '/reports', label: 'Reports', icon: 'fa-file-lines' }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16 gap-8">
            <Link
              to="/dashboard"
              className="text-lg font-bold text-gray-900 no-underline hover:opacity-90 flex-shrink-0"
            >
              Disaster Dashboard
            </Link>
            <div className="hidden sm:flex sm:gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path
                  const showAlertBadge = item.path === '/alerts' && hasNewAlert
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-link relative ${isActive ? 'nav-link-active' : 'nav-link-inactive'} ${showAlertBadge ? 'ring-2 ring-red-500 ring-offset-2 rounded-lg bg-red-50' : ''} no-underline`}
                    >
                      <i className={`fa-solid ${item.icon}`} style={{ width: '1rem', textAlign: 'center' }} />
                      {item.label}
                      {showAlertBadge && (
                        <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-xs">
                          <i className="fa-solid fa-bell text-[10px]" />
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 min-h-[60vh]">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
