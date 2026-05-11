import { useEffect, useState } from 'react'
import axios from 'axios'
import { useSocket } from '../context/SocketContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const SosList = () => {
  const { socket } = useSocket()
  const [sosList, setSosList] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSos = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/sos`)
      setSosList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Error fetching SOS:', err)
      setSosList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSos()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('sos-alert', (sos) => {
      setSosList((prev) => [sos, ...prev])
    })
    socket.on('sos-resolved', (sos) => {
      setSosList((prev) => prev.map((s) => (s._id === sos._id ? { ...s, ...sos, resolved: true } : s)))
    })
    return () => {
      socket.off('sos-alert')
      socket.off('sos-resolved')
    }
  }, [socket])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <i className="fa-solid fa-life-ring text-red-600" />
          SOS Alerts
        </h1>
        <p className="text-gray-500 text-sm mt-1">Emergency SOS requests sent by users</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-500" />
        </div>
      ) : sosList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <i className="fa-solid fa-life-ring text-4xl text-gray-300 mb-4" />
          <p className="text-gray-500">No SOS alerts yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sosList.map((sos) => (
            <div
              key={sos._id}
              className={`rounded-xl border p-5 shadow-sm transition-shadow ${
                sos.resolved
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{sos.userName || 'Anonymous'}</p>
                  <p className="text-sm text-gray-600">{sos.userPhone || 'No phone'}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {sos.location?.latitude?.toFixed(4)}, {sos.location?.longitude?.toFixed(4)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${sos.location?.latitude},${sos.location?.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                  >
                    View on map
                  </a>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-gray-500">
                    {sos.time ? new Date(sos.time).toLocaleString() : '—'}
                  </p>
                  {sos.resolved ? (
                    <span className="inline-block mt-2 px-3 py-1 bg-green-200 text-green-800 rounded-lg text-sm font-medium">
                      Resolved
                    </span>
                  ) : (
                    <span className="inline-block mt-2 px-3 py-1 bg-red-200 text-red-800 rounded-lg text-sm font-medium">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SosList
