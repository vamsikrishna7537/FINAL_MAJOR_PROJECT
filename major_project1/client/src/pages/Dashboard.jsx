import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const Dashboard = () => {
  const { socket } = useSocket()
  const [stats, setStats] = useState(null)
  const [recentDisasters, setRecentDisasters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('disaster-update', (disaster) => {
      setRecentDisasters((prev) => {
        const rest = prev.filter((d) => d._id !== disaster._id)
        return [disaster, ...rest].slice(0, 5)
      })
      fetchDashboardData()
    })
    socket.on('disaster-deleted', (id) => {
      setRecentDisasters((prev) => prev.filter((d) => d._id !== id))
      fetchDashboardData()
    })
    return () => {
      socket.off('disaster-update')
      socket.off('disaster-deleted')
    }
  }, [socket])

  const fetchDashboardData = async () => {
    setError(null)
    try {
      const [statsRes, disastersRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/stats`),
        axios.get(`${API_BASE}/api/disasters?limit=5`)
      ])
      setStats(statsRes?.data ?? null)
      const list = disastersRes?.data
      setRecentDisasters(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Could not load data. Ensure the server is running on port 5001.')
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (score) => {
    if (score >= 70) return 'text-red-600'
    if (score >= 40) return 'text-amber-600'
    return 'text-green-600'
  }

  const getRiskBadge = (score) => {
    if (score >= 70) return 'bg-red-500'
    if (score >= 40) return 'bg-amber-500'
    return 'bg-green-500'
  }

  const safeStats = stats && typeof stats === 'object' ? stats : null
  const safeDisasters = Array.isArray(recentDisasters) ? recentDisasters : []

  const statCards = [
    { label: 'Total Alerts', value: safeStats?.totalAlerts ?? 0, icon: 'fa-bell', color: 'text-blue-600', link: '/alerts' },
    { label: 'Active Disasters', value: safeStats?.activeDisasters ?? 0, icon: 'fa-triangle-exclamation', color: 'text-gray-700' },
    { label: 'Pending SOS', value: safeStats?.totalSOS ?? 0, icon: 'fa-life-ring', color: 'text-red-600', link: '/sos' }
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Overview of alerts and recent activity</p>
        </div>
        <Link
          to="/map"
          className="btn-primary no-underline"
        >
          <i className="fa-solid fa-map-location-dot" />
          View Map
        </Link>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-amber-800">
            <i className="fa-solid fa-circle-exclamation" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="text-center">
            <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-500 mb-3" />
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => {
              const content = (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">{card.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                  </div>
                  <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center">
                    <i className={`fa-solid ${card.icon} ${card.color}`} style={{ fontSize: '1.15rem' }} />
                  </div>
                </div>
              )
              return card.link ? (
                <Link key={card.label} to={card.link} className="card-panel p-5 block no-underline text-inherit hover:border-blue-200 hover:shadow-md transition-colors">
                  {content}
                </Link>
              ) : (
                <div key={card.label} className="card-panel p-5">
                  {content}
                </div>
              )
            })}
          </div>

          <div className="card-panel overflow-hidden">
            <h2 className="text-lg font-semibold text-gray-900 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <i className="fa-solid fa-list text-blue-600" />
              Recent Disasters
            </h2>
            <div className="p-6">
              {safeDisasters.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No disasters reported yet.</p>
              ) : (
                <div className="space-y-3">
                  {safeDisasters.map((disaster, index) => (
                    <div
                      key={disaster?._id ?? `disaster-${index}`}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${getRiskBadge(disaster?.riskScore ?? 0)}`} />
                        <div>
                          <p className="font-medium text-gray-900 capitalize">{disaster?.type ?? '—'}</p>
                          <p className="text-sm text-gray-500">
                            {disaster?.timestamp ? new Date(disaster.timestamp).toLocaleString() : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${getRiskColor(disaster?.riskScore ?? 0)}`}>
                          {disaster?.riskScore ?? 0}%
                        </p>
                        <p className="text-xs text-gray-500">Risk</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to="/map"
              className="card-panel group flex gap-4 p-6 no-underline text-gray-900 hover:border-blue-200 hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors shrink-0">
                <i className="fa-solid fa-map-location-dot text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Live Map</h3>
                <p className="text-gray-500 text-sm mt-1">View real-time disaster locations and risk zones</p>
              </div>
            </Link>
            <Link
              to="/reports"
              className="card-panel group flex gap-4 p-6 no-underline text-gray-900 hover:border-blue-200 hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors shrink-0">
                <i className="fa-solid fa-file-pen text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Submit Report</h3>
                <p className="text-gray-500 text-sm mt-1">Report incidents and help the community</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
