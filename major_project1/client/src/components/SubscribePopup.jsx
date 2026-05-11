import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const STORAGE_KEY = 'subscribe_popup_dismissed'

const SubscribePopup = () => {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    areaName: '',
    latitude: '',
    longitude: ''
  })
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const dismissed = sessionStorage.getItem(STORAGE_KEY)
    if (!dismissed) setOpen(true)
    const onOpen = () => {
      sessionStorage.removeItem(STORAGE_KEY)
      setOpen(true)
    }
    window.addEventListener('open-subscribe-popup', onOpen)
    return () => window.removeEventListener('open-subscribe-popup', onOpen)
  }, [])

  useEffect(() => {
    if (open) {
      axios.get(`${API_BASE}/api/subscribe/areas`)
        .then((res) => setAreas(res.data || []))
        .catch(() => setAreas([]))
    }
  }, [open])

  const close = () => {
    setOpen(false)
    sessionStorage.setItem(STORAGE_KEY, '1')
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(4),
          longitude: position.coords.longitude.toFixed(4),
          areaName: ''
        }))
        toast.success('Location captured')
        setLoading(false)
      },
      () => {
        toast.error('Could not get location')
        setLoading(false)
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    if (!formData.areaName && (!formData.latitude || !formData.longitude)) {
      toast.error('Please select an area or get your location')
      return
    }
    setLoading(true)
    try {
      await axios.post(`${API_BASE}/api/subscribe`, {
        name: formData.name.trim(),
        phone: formData.phone.trim().replace(/\s/g, ''),
        areaName: formData.areaName || undefined,
        latitude: formData.latitude || undefined,
        longitude: formData.longitude || undefined
      })
      toast.success('You are subscribed to disaster alerts')
      setFormData({ name: '', phone: '', areaName: '', latitude: '', longitude: '' })
      close()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Subscription failed')
    } finally {
      setLoading(false)
    }
  }

  if (location.pathname === '/admin' || !open) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={close}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark text-lg" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600">
              <i className="fa-solid fa-bell text-xl" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Subscribe for Alerts</h2>
              <p className="text-slate-500 text-sm">Get SMS alerts when disasters occur in your area.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
                placeholder="Your name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone (10 digits) *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                required
                placeholder="9876543210"
                maxLength={10}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Area *</label>
              <select
                value={formData.areaName}
                onChange={(e) => setFormData((p) => ({ ...p, areaName: e.target.value, latitude: '', longitude: '' }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select your area / city</option>
                {areas.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-sm">or</span>
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm"
              >
                <i className="fa-solid fa-location-dot" />
                Use my location
              </button>
            </div>

            {formData.latitude && formData.longitude && (
              <p className="text-sm text-slate-600">
                Location: {formData.latitude}, {formData.longitude}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg"
              >
                {loading ? 'Subscribing...' : 'Subscribe'}
              </button>
              <button
                type="button"
                onClick={close}
                className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-slate-700 hover:bg-gray-50"
              >
                Maybe later
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SubscribePopup
