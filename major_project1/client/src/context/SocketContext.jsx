import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const SocketContext = createContext(null)

export const useSocket = () => useContext(SocketContext)

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [hasNewAlert, setHasNewAlert] = useState(false)

  useEffect(() => {
    const s = io(API_BASE, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    })
    setSocket(s)
    s.on('new-alert', () => setHasNewAlert(true))
    return () => {
      s.off('new-alert')
      s.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, hasNewAlert, clearNewAlert: () => setHasNewAlert(false) }}>
      {children}
    </SocketContext.Provider>
  )
}
