import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useSocket } from '../context/SocketContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const Reports = () => {
  const { socket } = useSocket()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    description: '',
    latitude: '',
    longitude: '',
    type: 'other',
    image: null,
    name: ''
  })

  useEffect(() => {
    fetchReports()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('new-report', (report) => {
      setReports((prev) => [report, ...prev])
    })
    socket.on('report-approved', (report) => {
      setReports((prev) => prev.map((r) => (r._id === report._id ? { ...r, ...report } : r)))
    })
    socket.on('report-updated', (report) => {
      setReports((prev) => prev.map((r) => (r._id === report._id ? { ...r, ...report } : r)))
    })
    return () => {
      socket.off('new-report')
      socket.off('report-approved')
      socket.off('report-updated')
    }
  }, [socket])

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/reports`)
      setReports(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Error fetching reports:', error)
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    if (e.target.name === 'image') {
      setFormData({ ...formData, image: e.target.files[0] })
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value })
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition((position) => {
      setFormData({
        ...formData,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      })
      toast.success('Location captured')
    }, () => toast.error('Could not get location'))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.latitude || !formData.longitude) {
      toast.error('Please get your location first')
      return
    }
    const data = new FormData()
    data.append('description', formData.description)
    data.append('latitude', formData.latitude)
    data.append('longitude', formData.longitude)
    data.append('type', formData.type)
    data.append('name', formData.name || 'Anonymous')
    if (formData.image) data.append('image', formData.image)
    try {
      await axios.post(`${API_BASE}/api/reports`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Report submitted successfully')
      setShowForm(false)
      setFormData({ description: '', latitude: '', longitude: '', type: 'other', image: null, name: '' })
      fetchReports()
    } catch (error) {
      toast.error('Failed to submit report')
    }
  }

  const handleStatusChange = async (reportId, status) => {
    try {
      await axios.patch(`${API_BASE}/api/reports/${reportId}`, { status })
      toast.success('Report status updated')
      fetchReports()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    try {
      await axios.delete(`${API_BASE}/api/reports/${reportId}`)
      toast.success('Report deleted')
      fetchReports()
    } catch (error) {
      toast.error('Failed to delete report')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-amber-100 text-amber-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-file-lines text-primary-600" />
            Crowd Reports
          </h1>
          <p className="text-muted text-sm mt-0.5">Submit and manage incident reports</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium"
        >
          <i className={`fa-solid ${showForm ? 'fa-times' : 'fa-plus'}`} />
          {showForm ? 'Cancel' : 'New Report'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card p-6 rounded-xl border border-cardBorder shadow-card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-file-pen text-primary-600" />
            Submit Report
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your name (optional)</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-cardBorder rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-cardBorder rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-primary-500"
                placeholder="Describe the incident..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Disaster type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-cardBorder rounded-lg bg-white text-slate-800"
                >
                  <option value="flood">Flood</option>
                  <option value="earthquake">Earthquake</option>
                  <option value="cyclone">Cyclone</option>
                  <option value="fire">Fire</option>
                  <option value="landslide">Landslide</option>
                  <option value="tsunami">Tsunami</option>
                  <option value="drought">Drought</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  <i className="fa-solid fa-location-dot" />
                  Get current location
                </button>
                {formData.latitude && (
                  <p className="mt-2 text-sm text-muted">Lat: {formData.latitude}, Lng: {formData.longitude}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Photo (optional)</label>
              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={handleChange}
                className="w-full px-3 py-2 border border-cardBorder rounded-lg bg-white text-slate-800"
              />
            </div>
            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg font-medium">
              Submit report
            </button>
          </form>
        </div>
      )}

      <div className="bg-card rounded-xl border border-cardBorder shadow-card overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-800 px-6 py-4 border-b border-cardBorder">All reports</h2>
        <div className="p-6 space-y-4">
          {reports.length === 0 ? (
            <p className="text-muted text-center py-8">No reports submitted yet.</p>
          ) : (
            reports.map((report) => (
              <div key={report._id} className="p-4 bg-surface-50 rounded-lg border border-cardBorder">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                      <span className="font-medium text-slate-800 capitalize">{report.type}</span>
                      <span className="text-muted text-sm">by {report.userName || 'Anonymous'}</span>
                    </div>
                    <p className="text-slate-700 mb-2">{report.description}</p>
                    {report.image && (
                      <img
                        src={`${API_BASE}${report.image}`}
                        alt="Report"
                        className="max-w-xs rounded-lg mt-2 border border-cardBorder"
                      />
                    )}
                    <p className="text-sm text-muted mt-2">{new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleStatusChange(report._id, 'approved')} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-sm font-medium">
                      Approve
                    </button>
                    <button onClick={() => handleStatusChange(report._id, 'rejected')} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-medium">
                      Reject
                    </button>
                    <button onClick={() => handleDelete(report._id)} className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-slate-700 rounded-lg text-sm font-medium">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Reports
