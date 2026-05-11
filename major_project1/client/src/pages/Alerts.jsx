import { useEffect, useState } from 'react'
import axios from 'axios'
import { useSocket } from '../context/SocketContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const Alerts = () => {
  const { socket } = useSocket()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/alerts/history`)
      setAlerts(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Error fetching alerts:', err)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('new-alert', (alert) => {
      setAlerts((prev) => [alert, ...prev])
    })
    return () => socket.off('new-alert')
  }, [socket])

  const getSeverityColor = (severity) => {
    if (severity === 'critical') return 'bg-red-500'
    if (severity === 'high') return 'bg-red-400'
    if (severity === 'medium') return 'bg-amber-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <i className="fa-solid fa-bell text-blue-600" />
          Alerts
        </h1>
        <p className="text-gray-500 text-sm mt-1">Alerts sent to users in affected areas</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-500" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <i className="fa-solid fa-bell-slash text-4xl text-gray-300 mb-4" />
          <p className="text-gray-500">No alerts sent yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${getSeverityColor(alert.severity)}`} />
                    <span className="text-sm font-medium text-gray-500 capitalize">{alert.severity || 'medium'}</span>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-gray-500 capitalize">{alert.type || 'disaster'}</span>
                  </div>
                  <p className="text-gray-900 font-medium">{alert.message}</p>
                  {alert.location?.latitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${alert.location.latitude},${alert.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                    >
                      View on map
                    </a>
                  )}
                </div>
                <p className="text-sm text-gray-400 shrink-0">
                  {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Alerts
