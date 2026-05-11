import { useEffect, useState } from 'react'
import axios from 'axios'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import { useSocket } from '../context/SocketContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const Analytics = () => {
  const { socket } = useSocket()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('disaster-update', fetchAnalytics)
    socket.on('disaster-deleted', fetchAnalytics)
    return () => {
      socket.off('disaster-update', fetchAnalytics)
      socket.off('disaster-deleted', fetchAnalytics)
    }
  }, [socket])

  const fetchAnalytics = async () => {
    setError(null)
    try {
      const response = await axios.get(`${API_BASE}/api/admin/analytics`)
      setAnalytics(response.data)
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Could not load analytics. Ensure the server is running on port 5001.')
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(20)
    doc.text('Disaster Analytics Report', 20, 20)
    doc.setFontSize(12)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30)
    let yPos = 50
    if (analytics?.disasterDistribution) {
      doc.setFontSize(16)
      doc.text('Disaster Distribution', 20, yPos)
      yPos += 10
      analytics.disasterDistribution.forEach((item) => {
        doc.setFontSize(12)
        doc.text(`${item._id}: ${item.count} incidents`, 20, yPos)
        yPos += 7
      })
    }
    doc.save('disaster-analytics-report.pdf')
  }

  const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-primary-500 mb-3" />
          <p className="text-muted">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <i className="fa-solid fa-circle-exclamation text-amber-500 text-3xl mb-3" />
          <p className="text-amber-800 mb-4">{error}</p>
          <button onClick={fetchAnalytics} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const disasterData = analytics?.disasterDistribution?.map((item) => ({ name: item._id, value: item.count })) || []
  let trendData = analytics?.predictionTrends?.map((item) => ({
    date: item._id,
    count: item.count,
    avgRisk: Math.round(item.avgRisk)
  })) || []
  if (trendData.length === 1) {
    const d = trendData[0]
    const prevDate = new Date(d.date)
    prevDate.setDate(prevDate.getDate() - 1)
    trendData = [
      { date: prevDate.toISOString().slice(0, 10), count: 0, avgRisk: 0 },
      ...trendData
    ]
  }
  const riskData = analytics?.riskDistribution?.map((item) => ({ range: item._id, count: item.count })) || []
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-chart-pie text-primary-600" />
            Analytics
          </h1>
          <p className="text-muted text-sm mt-0.5">Charts and prediction trends</p>
        </div>
        <button
          onClick={exportPDF}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-card"
        >
          <i className="fa-solid fa-file-pdf" />
          Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-xl border border-cardBorder shadow-card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Prediction trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="mo
              
            notone" dataKey="count" stroke="#3b82f6" name="Predictions" />
              <Line type="monotone" dataKey="avgRisk" stroke="#ef4444" name="Avg Risk %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card p-6 rounded-xl border border-cardBorder shadow-card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Disaster distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={disasterData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {disasterData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card p-6 rounded-xl border border-cardBorder shadow-card lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Risk score distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="range" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default Analytics
