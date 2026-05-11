import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { SocketProvider } from './context/SocketContext'
import Dashboard from './pages/Dashboard'
import Map from './pages/Map'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import Alerts from './pages/Alerts'
import SosList from './pages/SosList'
import Admin from './pages/Admin'
import Layout from './components/Layout'
import SubscribePopup from './components/SubscribePopup'

function App() {
  return (
    <SocketProvider>
    <Router>
      <Toaster position="top-right" />
      <SubscribePopup />
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="map" element={<Map />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="sos" element={<SosList />} />
        </Route>
      </Routes>
    </Router>
    </SocketProvider>
  )
}

export default App
