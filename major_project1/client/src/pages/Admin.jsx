import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useSocket } from '../context/SocketContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
  { id: 'users', label: 'Users', icon: 'fa-users' },
  { id: 'disasters', label: 'Disasters', icon: 'fa-triangle-exclamation' },
  { id: 'alerts', label: 'Alerts', icon: 'fa-bell' },
  { id: 'reports', label: 'Reports', icon: 'fa-file-lines' },
  { id: 'sos', label: 'SOS', icon: 'fa-life-ring' }
]

const Admin = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { socket } = useSocket()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'overview')
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [disasters, setDisasters] = useState([])
  const [alerts, setAlerts] = useState([])
  const [reports, setReports] = useState([])
  const [sosList, setSosList] = useState([])
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Alert form state
  const [alertForm, setAlertForm] = useState({
    disasterId: '',
    message: '',
    type: 'disaster',
    severity: 'high',
    latitude: '',
    longitude: '',
    radius: 20,
    notifyAll: false
  })
  const [sendingAlert, setSendingAlert] = useState(false)

  // Auto-alert settings
  const [autoAlert, setAutoAlert] = useState(false)
  const [minRisk, setMinRisk] = useState(70)
  const [savingSettings, setSavingSettings] = useState(false)

  // User edit modal
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', latitude: '', longitude: '', areaName: '' })
  const [savingUser, setSavingUser] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const fetchData = async () => {
    setError(null)
    try {
      const [statsRes, analyticsRes, disastersRes, alertsRes, reportsRes, sosRes, settingsRes, subsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/stats`),
        axios.get(`${API_BASE}/api/admin/analytics`),
        axios.get(`${API_BASE}/api/disasters`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/alerts/history`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/reports`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/sos`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/admin/settings`).catch(() => ({ data: { autoAlert: false, minRisk: 70 } })),
        axios.get(`${API_BASE}/api/subscribe`).catch(() => ({ data: [] }))
      ])
      setStats(statsRes.data)
      setAnalytics(analyticsRes.data)
      setDisasters(Array.isArray(disastersRes.data) ? disastersRes.data : [])
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : [])
      setReports(Array.isArray(reportsRes.data) ? reportsRes.data : [])
      setSosList(Array.isArray(sosRes.data) ? sosRes.data : [])
      if (settingsRes?.data) {
        setAutoAlert(!!settingsRes.data.autoAlert)
        setMinRisk(settingsRes.data.minRisk ?? 70)
      }
      setSubscribers(Array.isArray(subsRes?.data) ? subsRes.data : [])
    } catch (err) {
      console.error('Error fetching admin data:', err)
      setError('Could not load data. Ensure the server is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && TABS.some((tab) => tab.id === t)) setActiveTab(t)
  }, [searchParams])

  useEffect(() => {
    if (!socket) return
    const onUpdate = () => fetchData()
    socket.on('disaster-update', onUpdate)
    socket.on('disaster-deleted', onUpdate)
    socket.on('new-report', onUpdate)
    socket.on('report-updated', onUpdate)
    socket.on('report-approved', onUpdate)
    socket.on('new-alert', onUpdate)
    socket.on('sos-alert', onUpdate)
    socket.on('sos-resolved', onUpdate)
    return () => {
      socket.off('disaster-update', onUpdate)
      socket.off('disaster-deleted', onUpdate)
      socket.off('new-report', onUpdate)
      socket.off('report-updated', onUpdate)
      socket.off('report-approved', onUpdate)
      socket.off('new-alert', onUpdate)
      socket.off('sos-alert', onUpdate)
      socket.off('sos-resolved', onUpdate)
    }
  }, [socket])

  const selectDisasterForAlert = (disaster) => {
    if (!disaster) return
    setAlertForm((prev) => ({
      ...prev,
      disasterId: disaster._id,
      latitude: disaster.latitude,
      longitude: disaster.longitude,
      message: prev.message || `High ${disaster.type} risk in ${disaster.locationName || 'the area'}. Stay safe and follow local authorities.`,
      notifyAll: false
    }))
  }

  const handleSendAlert = async (e) => {
    e.preventDefault()
    if (!alertForm.message.trim()) {
      toast.error('Enter alert message')
      return
    }
    setSendingAlert(true)
    try {
      const payload = {
        message: alertForm.message.trim(),
        type: alertForm.type,
        severity: alertForm.severity,
        notifyAll: alertForm.notifyAll
      }
      if (!alertForm.notifyAll && (alertForm.latitude || alertForm.longitude)) {
        payload.location = {
          latitude: parseFloat(alertForm.latitude) || 0,
          longitude: parseFloat(alertForm.longitude) || 0
        }
        payload.radius = parseFloat(alertForm.radius) || 20
      }
      const res = await axios.post(`${API_BASE}/api/alerts/send`, payload)
      const { smsSent = 0, usersNotified = 0, smsError } = res.data
      if (smsSent > 0) {
        toast.success(`Alert sent. SMS delivered to ${smsSent} user(s).`)
      } else if (usersNotified > 0 && smsError) {
        toast.error(`Alert sent (popup shown to users). SMS failed: ${smsError}`)
      } else if (usersNotified > 0) {
        toast(`Alert sent. ${usersNotified} users in area but SMS not sent. Check FAST2SMS_API_KEY.`, { icon: '⚠️' })
      } else {
        toast(`Alert sent (popup shown). No users in area. Use "Notify all" to reach everyone.`, { icon: 'ℹ️' })
      }
      setAlertForm({ disasterId: '', message: '', type: 'disaster', severity: 'high', latitude: '', longitude: '', radius: 20, notifyAll: false })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send alert')
    } finally {
      setSendingAlert(false)
    }
  }

  const handleReportStatus = async (reportId, status) => {
    try {
      await axios.patch(`${API_BASE}/api/reports/${reportId}`, { status })
      toast.success(`Report ${status}`)
      fetchData()
    } catch (err) {
      toast.error('Failed to update report')
    }
  }

  const handleSaveAutoAlert = async () => {
    setSavingSettings(true)
    try {
      await axios.patch(`${API_BASE}/api/admin/settings`, { autoAlert, minRisk })
      toast.success('Auto alert settings saved')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save settings'
      toast.error(msg)
      console.error('Save settings error:', err.response?.data || err)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleResolveSos = async (sosId, notes) => {
    try {
      await axios.patch(`${API_BASE}/api/sos/${sosId}/resolve`, { notes })
      toast.success('SOS resolved')
      fetchData()
    } catch (err) {
      toast.error('Failed to resolve SOS')
    }
  }

  const openEditUser = (s) => {
    setEditingUser(s)
    setEditForm({
      name: s.name || '',
      phone: s.phone || '',
      latitude: s.latitude != null ? String(s.latitude) : '',
      longitude: s.longitude != null ? String(s.longitude) : '',
      areaName: s.areaName || ''
    })
  }

  const closeEditUser = () => {
    setEditingUser(null)
    setEditForm({ name: '', phone: '', latitude: '', longitude: '', areaName: '' })
  }

  const handleSaveUser = async (e) => {
    e.preventDefault()
    if (!editingUser?._id) return
    setSavingUser(true)
    try {
      await axios.patch(`${API_BASE}/api/subscribe/${editingUser._id}`, editForm)
      toast.success('User updated')
      closeEditUser()
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user')
    } finally {
      setSavingUser(false)
    }
  }

  const handleDeleteUser = async (s) => {
    if (!confirm(`Delete ${s.name || 'this user'}?`)) return
    setDeletingId(s._id)
    try {
      await axios.delete(`${API_BASE}/api/subscribe/${s._id}`)
      toast.success('User deleted')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1>
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-xl text-center">
          <i className="fa-solid fa-circle-exclamation text-amber-500 text-3xl mb-4" />
          <p className="text-amber-800 mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const disasterData = stats?.disasterDistribution?.map((item) => ({ name: item._id, value: item.count })) || []
  const severityData = stats?.alertsBySeverity?.map((item) => ({ name: item._id, value: item.count })) || []
  let trendData = analytics?.predictionTrends?.map((item) => ({ date: item._id, count: item.count, avgRisk: Math.round(item.avgRisk) })) || []
  if (trendData.length === 1) {
    const d = trendData[0]
    const prevDate = new Date(d.date)
    prevDate.setDate(prevDate.getDate() - 1)
    trendData = [{ date: prevDate.toISOString().slice(0, 10), count: 0, avgRisk: 0 }, ...trendData]
  }
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
  const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }

  const statCards = [
    { label: 'Total Alerts', value: stats?.totalAlerts ?? 0, icon: 'fa-bell' },
    { label: 'Active Users', value: stats?.activeUsers ?? 0, icon: 'fa-users' },
    { label: 'Active Disasters', value: stats?.activeDisasters ?? 0, icon: 'fa-triangle-exclamation' },
    { label: 'Pending SOS', value: stats?.totalSOS ?? 0, icon: 'fa-life-ring', highlight: 'red' },
    { label: 'Pending Reports', value: stats?.pendingReports ?? 0, icon: 'fa-clock', highlight: 'yellow' },
    { label: 'Total Reports', value: stats?.totalReports ?? 0, icon: 'fa-file-lines' }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        <header className="border-b border-gray-200 pb-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-gear text-blue-600" />
              Admin Panel
            </h1>
            <p className="text-slate-600 mt-1 text-sm">Manage disasters, alerts, reports, and SOS</p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium text-sm"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to Dashboard
          </Link>
        </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchParams({ tab: tab.id }) }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition-colors ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Key metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {statCards.map((card) => (
                <div key={card.label} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-600 text-sm font-medium">{card.label}</p>
                    <i className={`fa-solid ${card.icon} text-slate-400`} />
                  </div>
                  <p className={`text-2xl font-bold mt-2 ${card.highlight === 'red' ? 'text-red-600' : card.highlight === 'yellow' ? 'text-amber-600' : 'text-slate-800'}`}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-semibold text-slate-800 mb-4">Prediction trends</h3>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Predictions" />
                      <Line type="monotone" dataKey="avgRisk" stroke="#ef4444" strokeWidth={2} name="Avg Risk" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-slate-500">No trend data</div>
                )}
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-semibold text-slate-800 mb-4">Disaster distribution</h3>
                {disasterData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={disasterData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                        {disasterData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-slate-500">No disaster data</div>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent incidents</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {!stats?.recentIncidents?.length ? (
                <p className="text-slate-500 py-8 text-center">No recent incidents</p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {stats.recentIncidents.map((incident) => (
                    <div key={incident._id} className="flex justify-between items-center p-4 hover:bg-gray-50">
                      <div>
                        <span className="font-medium text-slate-800 capitalize">{incident.type}</span>
                        <p className="text-sm text-slate-500 mt-0.5">{new Date(incident.timestamp).toLocaleString()}</p>
                      </div>
                      <span className={`font-bold ${incident.riskScore >= 70 ? 'text-red-600' : incident.riskScore >= 40 ? 'text-amber-600' : 'text-green-600'}`}>{incident.riskScore}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-slate-800">Users / Alert Subscribers</h2>
            <p className="text-sm text-slate-500 mt-0.5">People who registered for alerts. Alerts are sent to those in the danger zone when disasters occur.</p>
          </div>
          <div className="divide-y divide-gray-200">
            {subscribers.length === 0 ? (
              <p className="text-slate-500 py-12 text-center">No subscribers yet. Users can subscribe via the popup when they first visit the website.</p>
            ) : (
              subscribers.map((s) => {
                const lat = s.latitude
                const lng = s.longitude
                const distanceKm = (lat1, lon1, lat2, lon2) => {
                  const R = 6371
                  const dLat = (lat2 - lat1) * Math.PI / 180
                  const dLon = (lon2 - lon1) * Math.PI / 180
                  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                  return R * c
                } // Haversine distance in km
                const inDanger = lat != null && lng != null && disasters.some((d) => {
                  if (d.latitude == null || d.longitude == null) return false
                  return distanceKm(lat, lng, d.latitude, d.longitude) <= 25
                })
                const nearestDisaster = inDanger && lat != null && lng != null && disasters.length > 0
                  ? disasters.reduce((best, d) => {
                      if (d.latitude == null || d.longitude == null) return best
                      const dist = distanceKm(lat, lng, d.latitude, d.longitude)
                      if (!best || dist < best.dist) return { disaster: d, dist }
                      return best
                    }, null)
                  : null
                return (
                  <div key={s._id} className={`flex flex-wrap justify-between items-center p-4 gap-4 ${inDanger ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <div>
                      <p className="font-medium text-slate-800">{s.name || '—'}</p>
                      <p className="text-sm text-slate-600">{s.phone}</p>
                      <p className="text-sm text-slate-500 mt-1">{s.areaName || `${lat?.toFixed(2)}, ${lng?.toFixed(2)}`}</p>
                      {inDanger && (
                        <span className="inline-block mt-2 px-2 py-1 bg-red-200 text-red-800 text-xs font-medium rounded">
                          In danger zone
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditUser(s)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                        title="Edit"
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(s)}
                        disabled={deletingId === s._id}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === s._id ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-trash" />}
                      </button>
                      {inDanger && nearestDisaster && (
                        <button
                          onClick={() => { selectDisasterForAlert(nearestDisaster.disaster); setActiveTab('alerts'); }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                        >
                          Send Alert
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Disasters */}
      {activeTab === 'disasters' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-slate-800">Active Disasters</h2>
            <p className="text-sm text-slate-500 mt-0.5">Click a disaster to use its location when sending an alert</p>
          </div>
          <div className="divide-y divide-gray-200">
            {disasters.length === 0 ? (
              <p className="text-slate-500 py-12 text-center">No disasters</p>
            ) : (
              disasters.map((d) => (
                <div key={d._id} className="flex flex-wrap justify-between items-center p-4 hover:bg-gray-50 gap-4">
                  <div>
                    <span className="font-medium text-slate-800 capitalize">{d.type}</span>
                    {d.locationName && <span className="text-slate-600 ml-2">({d.locationName})</span>}
                    <p className="text-sm text-slate-500 mt-1">{d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)} | Risk: {d.riskScore}%</p>
                  </div>
                  <button
                    onClick={() => { selectDisasterForAlert(d); setActiveTab('alerts'); }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    Send Alert for this
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Alerts */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Auto Alert</h2>
            <p className="text-sm text-slate-500 mb-4">When a prediction matches the risk level, automatically send alert and SMS to users in the area.</p>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAlert}
                  onChange={(e) => setAutoAlert(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-slate-700 font-medium">Enable auto alert</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-slate-700 text-sm">Min risk (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minRisk}
                  onChange={(e) => setMinRisk(Number(e.target.value) || 70)}
                  className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-slate-800"
                />
                <span className="text-slate-500 text-sm">Predictions at or above this level trigger alert</span>
              </div>
              <button
                onClick={handleSaveAutoAlert}
                disabled={savingSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm"
              >
                {savingSettings ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Subscribers by area</h2>
            <p className="text-sm text-slate-500 mb-4">Users who registered for alerts. Alerts sent to an area reach these subscribers (plus Users with location).</p>
            {subscribers.length === 0 ? (
              <p className="text-slate-500 py-4">No subscribers yet. Users can subscribe at Subscribe for Alerts.</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {Object.entries(
                  subscribers.reduce((acc, s) => {
                    const area = s.areaName || `${s.latitude?.toFixed(1)}, ${s.longitude?.toFixed(1)}` || 'Unknown'
                    if (!acc[area]) acc[area] = []
                    acc[area].push(s)
                    return acc
                  }, {})
                ).map(([area, list]) => (
                  <div key={area} className="text-sm">
                    <span className="font-medium text-slate-700">{area}</span>
                    <span className="text-slate-500 ml-2">({list.length})</span>
                    <div className="text-slate-600 mt-0.5">
                      {list.map((s) => `${s.name} (${s.phone})`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Send Alert (SMS + popup to users)</h2>
            <p className="text-sm text-slate-500 mb-4">Alert popup appears for all users with the dashboard open. SMS goes to subscribers in radius (or all if Notify all). Check FAST2SMS_API_KEY in server/.env for SMS delivery.</p>
            <form onSubmit={handleSendAlert} className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select disaster (optional)</label>
                <select
                  value={alertForm.disasterId}
                  onChange={(e) => selectDisasterForAlert(disasters.find((d) => d._id === e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="">Custom location</option>
                  {disasters.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.type} - {d.locationName || `${d.latitude?.toFixed(2)}, ${d.longitude?.toFixed(2)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="notifyAll" checked={alertForm.notifyAll} onChange={(e) => setAlertForm((p) => ({ ...p, notifyAll: e.target.checked }))} className="rounded border-gray-300" />
                <label htmlFor="notifyAll" className="text-sm text-slate-700">Notify all users (ignore location)</label>
              </div>
              {!alertForm.notifyAll && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                    <input type="number" step="any" value={alertForm.latitude} onChange={(e) => setAlertForm((p) => ({ ...p, latitude: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. 13.08" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                    <input type="number" step="any" value={alertForm.longitude} onChange={(e) => setAlertForm((p) => ({ ...p, longitude: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. 80.27" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Radius (km)</label>
                    <input type="number" min="1" value={alertForm.radius} onChange={(e) => setAlertForm((p) => ({ ...p, radius: e.target.value || 20 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message *</label>
                <textarea value={alertForm.message} onChange={(e) => setAlertForm((p) => ({ ...p, message: e.target.value }))} rows={3} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-800" placeholder="Alert message sent via SMS to users in area" />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                  <select value={alertForm.severity} onChange={(e) => setAlertForm((p) => ({ ...p, severity: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={sendingAlert} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                {sendingAlert ? 'Sending...' : 'Send Alert (SMS)'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h2 className="px-6 py-4 border-b border-gray-200 font-semibold text-slate-800">Alert History</h2>
            <div className="divide-y divide-gray-200">
              {alerts.length === 0 ? (
                <p className="text-slate-500 py-12 text-center">No alerts sent yet</p>
              ) : (
                alerts.map((a) => (
                  <div key={a._id} className="p-4 hover:bg-gray-50">
                    <p className="font-medium text-slate-800">{a.message}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {a.severity} | {new Date(a.createdAt).toLocaleString()} | Notified: {a.usersNotified?.length ?? 0}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Reports */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-slate-800">Reports</h2>
            <p className="text-sm text-slate-500 mt-0.5">Approve or reject submitted reports</p>
          </div>
          <div className="divide-y divide-gray-200">
            {reports.length === 0 ? (
              <p className="text-slate-500 py-12 text-center">No reports</p>
            ) : (
              reports.map((r) => (
                <div key={r._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'approved' ? 'bg-green-100 text-green-800' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>{r.status}</span>
                    <span className="font-medium capitalize">{r.type}</span>
                    <span className="text-slate-500 text-sm">by {r.userName || 'Anonymous'}</span>
                  </div>
                  <p className="text-slate-700">{r.description}</p>
                  {r.image && <img src={`${API_BASE}${r.image}`} alt="Report" className="mt-2 max-w-xs rounded-lg border border-gray-200" />}
                  <p className="text-sm text-slate-500 mt-2">{new Date(r.createdAt).toLocaleString()}</p>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleReportStatus(r._id, 'approved')} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-sm font-medium">Approve</button>
                      <button onClick={() => handleReportStatus(r._id, 'rejected')} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-medium">Reject</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeEditUser}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Edit user</h3>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-800"
                  placeholder="User name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-800"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
                <input
                  type="text"
                  value={editForm.areaName}
                  onChange={(e) => setEditForm((p) => ({ ...p, areaName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-800"
                  placeholder="e.g. Chennai"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.latitude}
                    onChange={(e) => setEditForm((p) => ({ ...p, latitude: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-800"
                    placeholder="13.08"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.longitude}
                    onChange={(e) => setEditForm((p) => ({ ...p, longitude: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-slate-800"
                    placeholder="80.27"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeEditUser} className="px-4 py-2 text-slate-600 hover:bg-gray-100 rounded-lg font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={savingUser} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                  {savingUser ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: SOS */}
      {activeTab === 'sos' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-slate-800">SOS Requests</h2>
            <p className="text-sm text-slate-500 mt-0.5">Resolve emergency requests from users</p>
          </div>
          <div className="divide-y divide-gray-200">
            {sosList.length === 0 ? (
              <p className="text-slate-500 py-12 text-center">No SOS requests</p>
            ) : (
              sosList.map((s) => (
                <div key={s._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="font-medium text-slate-800">{s.userName || 'Anonymous'}</p>
                      <p className="text-sm text-slate-600">{s.userPhone || 'No phone'}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {s.location?.latitude?.toFixed(4)}, {s.location?.longitude?.toFixed(4)}
                        {' | '}
                        <a href={`https://www.google.com/maps?q=${s.location?.latitude},${s.location?.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View on map
                        </a>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(s.time).toLocaleString()}</p>
                    </div>
                    {!s.resolved ? (
                      <button onClick={() => handleResolveSos(s._id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                        Resolve
                      </button>
                    ) : (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-medium">Resolved</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default Admin
