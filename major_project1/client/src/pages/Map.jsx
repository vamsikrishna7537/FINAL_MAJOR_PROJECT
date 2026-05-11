import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useSocket } from '../context/SocketContext'

const mapboxToken = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'
if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken
}

const Map = () => {
  const { socket } = useSocket()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(null)
  const [disasters, setDisasters] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [shelters, setShelters] = useState([])
  const [showShelters, setShowShelters] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const markersRef = useRef([])
  const heatmapLayerRef = useRef(null)

  useEffect(() => {
    if (map.current) return
    if (!mapboxToken || !mapboxToken.trim()) {
      setMapError('no-token')
      return
    }
    setMapError(null)

    const container = mapContainer.current
    if (!container) return

    const initMap = () => {
      if (map.current) return
      map.current = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [77.2090, 28.6139],
        zoom: 5
      })

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e)
        const err = e?.error
        const msg = err?.message || (typeof err === 'string' ? err : 'Map failed to load')
        const isTokenErr = msg?.includes?.('401') || msg?.toLowerCase?.().includes?.('token') || msg?.includes?.('Unauthorized')
        const hint = isTokenErr
          ? 'Token may be invalid, expired, or missing scopes. Check at account.mapbox.com. Restart dev server after changing .env.'
          : 'Restart the dev server (npm run dev) after adding or changing VITE_MAPBOX_TOKEN in client/.env.'
        setMapError(msg ? `${msg}\n\n${hint}` : 'Map failed to load.')
      })

      map.current.on('load', () => {
        setMapError(null)
        setMapLoaded(true)
        map.current.resize()
        fetchDisasters()
        fetchShelters()
        fetchHeatmapData()
      })
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(initMap)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('disaster-update', (disaster) => {
      setDisasters((prev) => {
        const filtered = prev.filter((d) => d._id !== disaster._id)
        return [disaster, ...filtered]
      })
    })
    socket.on('disaster-deleted', (id) => {
      setDisasters((prev) => prev.filter((d) => d._id !== id))
      removeMarker(id)
    })
    socket.on('new-alert', (alert) => {
      toast.error(`Alert: ${alert.message}`)
    })
    socket.on('sos-alert', (sos) => {
      toast.error(`SOS Alert from ${sos.user?.name || 'Anonymous'}`)
    })
    return () => {
      socket.off('disaster-update')
      socket.off('disaster-deleted')
      socket.off('new-alert')
      socket.off('sos-alert')
    }
  }, [socket])

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    clearMarkers()
    disasters.forEach((disaster) => {
      if (filterType === 'all' || disaster.type === filterType) {
        addDisasterMarker(disaster)
      }
    })
  }, [disasters, filterType, mapLoaded])

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    if (!showHeatmap) {
      removeHeatmap()
      return
    }
    const points =
      heatmapData.length > 0
        ? heatmapData.map((p) => ({ lat: p.lat, lng: p.lng, intensity: p.intensity ?? 0.5, _id: p._id, type: p.type, riskScore: p.riskScore, status: p.status, timestamp: p.timestamp, locationName: p.locationName }))
        : disasters.map((d) => ({
            lat: d.latitude,
            lng: d.longitude,
            intensity: (d.riskScore || 0) / 100,
            _id: d._id,
            type: d.type,
            riskScore: d.riskScore,
            status: d.status,
            timestamp: d.timestamp,
            locationName: d.locationName
          }))
    if (points.length > 0) {
      updateHeatmap(points)
    } else {
      removeHeatmap()
    }
  }, [showHeatmap, heatmapData, disasters, mapLoaded])

  useEffect(() => {
    if (mapLoaded && showShelters) {
      addShelterMarkers()
    } else {
      removeShelterMarkers()
    }
  }, [showShelters, shelters, mapLoaded])

  const fetchDisasters = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/disasters`)
      setDisasters(response.data)
    } catch (error) {
      console.error('Error fetching disasters:', error)
    }
  }

  const fetchHeatmapData = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/map/heatmap`)
      setHeatmapData(response.data)
    } catch (error) {
      console.error('Error fetching heatmap:', error)
    }
  }

  const fetchShelters = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/map/shelters`)
      setShelters(response.data)
    } catch (error) {
      console.error('Error fetching shelters:', error)
    }
  }

  const getRiskColor = (score) => {
    if (score >= 70) return '#ef4444' // red
    if (score >= 40) return '#eab308' // yellow
    return '#22c55e' // green
  }

  const addDisasterMarker = (disaster) => {
    if (!map.current) return

    const color = getRiskColor(disaster.riskScore)
    const el = document.createElement('div')
    el.className = 'disaster-marker'
    el.style.width = '20px'
    el.style.height = '20px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = color
    el.style.border = '2px solid white'
    el.style.cursor = 'pointer'

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div class="text-slate-800">
        <h3 class="font-bold capitalize">${disaster.type || '—'}</h3>
        <p>Risk Score: <span class="font-bold">${disaster.riskScore ?? 0}%</span></p>
        <p>Status: <span class="capitalize">${disaster.status || 'active'}</span></p>
        <p class="text-xs text-slate-500">${disaster.timestamp ? new Date(disaster.timestamp).toLocaleString() : ''}</p>
      </div>
    `)

    const marker = new mapboxgl.Marker(el)
      .setLngLat([disaster.longitude, disaster.latitude])
      .setPopup(popup)
      .addTo(map.current)

    markersRef.current.push({ id: disaster._id, marker, type: 'disaster' })
  }

  const addShelterMarkers = () => {
    if (!map.current) return

    shelters.forEach((shelter) => {
      const el = document.createElement('div')
      el.className = 'shelter-marker'
      el.innerHTML = shelter.type === 'hospital' ? '<i class="fa-solid fa-hospital" style="font-size:22px;color:#2563eb"></i>' : '<i class="fa-solid fa-house" style="font-size:22px;color:#059669"></i>'
      el.style.cursor = 'pointer'

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="text-slate-800">
          <h3 class="font-bold">${shelter.name}</h3>
          <p>Type: <span class="capitalize">${shelter.type}</span></p>
          <p>Capacity: ${shelter.capacity}</p>
          ${shelter.distance ? `<p>Distance: ${shelter.distance.toFixed(2)} km</p>` : ''}
        </div>
      `)

      const marker = new mapboxgl.Marker(el)
        .setLngLat([shelter.longitude, shelter.latitude])
        .setPopup(popup)
        .addTo(map.current)

      markersRef.current.push({ id: shelter._id, marker, type: 'shelter' })
    })
  }

  const removeShelterMarkers = () => {
    markersRef.current = markersRef.current.filter((item) => {
      if (item.type === 'shelter') {
        item.marker.remove()
        return false
      }
      return true
    })
  }

  const clearMarkers = () => {
    markersRef.current.forEach((item) => {
      if (item.type === 'disaster') {
        item.marker.remove()
      }
    })
    markersRef.current = markersRef.current.filter((item) => item.type !== 'disaster')
  }

  const removeMarker = (id) => {
    const index = markersRef.current.findIndex((item) => item.id === id)
    if (index !== -1) {
      markersRef.current[index].marker.remove()
      markersRef.current.splice(index, 1)
    }
  }

  const updateHeatmap = (points) => {
    if (!map.current) return
    const geojson = {
      type: 'FeatureCollection',
      features: (points || []).map((point) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lng, point.lat]
        },
        properties: {
          intensity: point.intensity != null ? point.intensity : 0.5,
          _id: point._id || '',
          type: point.type || '',
          riskScore: point.riskScore != null ? point.riskScore : 0,
          status: point.status || '',
          timestamp: point.timestamp || null,
          locationName: point.locationName || ''
        }
      }))
    }
    try {
      if (!map.current.getSource('heatmap')) {
        map.current.addSource('heatmap', {
          type: 'geojson',
          data: geojson
        })
        // Heatmap layer: large radius so multiple areas in one city show clearly; no maxzoom
        map.current.addLayer({
          id: 'heatmap-layer',
          type: 'heatmap',
          source: 'heatmap',
          paint: {
            'heatmap-weight': [
              'interpolate', ['linear'],
              ['get', 'intensity'], 0, 0, 0.5, 1, 1, 2
            ],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 3, 6, 5, 9, 8, 12, 12, 15, 16, 18, 20],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33, 102, 172, 0)',
              0.12, 'rgba(103, 169, 207, 0.75)',
              0.3, 'rgba(209, 229, 240, 0.9)',
              0.5, 'rgba(253, 219, 199, 0.95)',
              0.7, 'rgba(239, 138, 98, 0.95)',
              1, 'rgba(178, 24, 43, 0.95)'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 55, 6, 95, 9, 150, 12, 220, 15, 320, 18, 450],
            'heatmap-opacity': 0.88
          }
        })
        // Clickable circle layer: large hit area so clicking the heat shows disaster details
        map.current.addLayer({
          id: 'heatmap-circles',
          type: 'circle',
          source: 'heatmap',
          minzoom: 0,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 45, 9, 80, 12, 130, 15, 200, 18, 300],
            'circle-opacity': 0,
            'circle-stroke-width': 0
          }
        })
        map.current.on('click', 'heatmap-circles', (e) => {
          const f = e.features?.[0]
          if (!f?.properties) return
          const p = f.properties
          const coords = f.geometry.type === 'Point' ? f.geometry.coordinates.slice() : null
          if (!coords) return
          while (Math.abs(e.lngLat.lng - coords[0]) > 180) coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
          new mapboxgl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div class="text-slate-800 min-w-[180px]">
                <h3 class="font-bold capitalize">${(p.type || 'Disaster').replace(/-/g, ' ')}</h3>
                ${p.locationName ? `<p class="text-slate-600 text-sm">${p.locationName}</p>` : ''}
                <p>Risk: <span class="font-bold">${p.riskScore != null ? p.riskScore : '—'}%</span></p>
                <p>Status: <span class="capitalize">${p.status || '—'}</span></p>
                ${p.timestamp ? `<p class="text-xs text-slate-500">${new Date(p.timestamp).toLocaleString()}</p>` : ''}
              </div>
            `)
            .addTo(map.current)
        })
        map.current.on('mouseenter', 'heatmap-circles', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'heatmap-circles', () => {
          if (map.current) map.current.getCanvas().style.cursor = ''
        })
      } else {
        map.current.getSource('heatmap').setData(geojson)
      }
    } catch (err) {
      console.error('Heatmap error:', err)
    }
  }

  const removeHeatmap = () => {
    if (!map.current) return
    if (map.current.getLayer('heatmap-circles')) {
      map.current.off('click', 'heatmap-circles')
      map.current.off('mouseenter', 'heatmap-circles')
      map.current.off('mouseleave', 'heatmap-circles')
      map.current.removeLayer('heatmap-circles')
    }
    if (map.current.getLayer('heatmap-layer')) {
      map.current.removeLayer('heatmap-layer')
    }
    if (map.current.getSource('heatmap')) {
      map.current.removeSource('heatmap')
    }
  }

  const handleSOS = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const name = prompt('Enter your name (optional):') || 'Anonymous'
        const phone = prompt('Enter your phone (optional):') || ''
        await axios.post(`${API_BASE}/api/sos`, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          name,
          phone
        })
        toast.success('SOS alert sent! Help is on the way.')
      } catch (error) {
        toast.error('Failed to send SOS alert')
      }
    })
  }

  const showPlaceholder = mapError === 'no-token' || (mapError && !mapLoaded)

  return (
    <div className="relative rounded-xl overflow-hidden border border-cardBorder shadow-card bg-gray-100" style={{ height: 'calc(100vh - 8rem)', minHeight: '400px' }}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" style={{ minHeight: 400 }} />
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 p-6 z-[5]">
          <div className="max-w-md bg-white rounded-xl border border-gray-200 shadow-lg p-6 text-center">
            <i className="fa-solid fa-map-location-dot text-4xl text-blue-500 mb-3" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {mapError === 'no-token' ? 'Mapbox token required' : 'Map could not load'}
            </h3>
            <p className="text-gray-600 text-sm mb-4 whitespace-pre-wrap">
              {mapError === 'no-token'
                ? 'Add your Mapbox access token to client/.env as VITE_MAPBOX_TOKEN=your_token, then restart the dev server (Ctrl+C and npm run dev).'
                : mapError}
            </p>
            {mapError === 'no-token' && (
              <a
                href="https://account.mapbox.com/access-tokens/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Get Mapbox token
                <i className="fa-solid fa-external-link" />
              </a>
            )}
            <p className="text-gray-500 text-xs mt-4">
              In client/.env add: <code className="bg-gray-100 px-1 rounded">VITE_MAPBOX_TOKEN=your_token</code>
            </p>
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 bg-card p-4 rounded-xl border border-cardBorder shadow-card space-y-3 z-10 max-w-[200px]">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Filter by type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border border-cardBorder rounded-lg bg-white text-slate-800 text-sm"
          >
            <option value="all">All types</option>
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
        <label className="flex items-center gap-2 text-slate-700 text-sm cursor-pointer" title="Click the heat area to see disaster details">
          <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} className="rounded border-cardBorder" />
          <span>Show heatmap</span>
        </label>
        {showHeatmap && (
          <p className="text-xs text-slate-500">Click heat area for details</p>
        )}
        <label className="flex items-center gap-2 text-slate-700 text-sm cursor-pointer">
          <input type="checkbox" checked={showShelters} onChange={(e) => setShowShelters(e.target.checked)} className="rounded border-cardBorder" />
          <span>Show shelters</span>
        </label>
      </div>

      <button
        onClick={handleSOS}
        className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg z-10"
      >
        <i className="fa-solid fa-life-ring" />
        SOS
      </button>

      <div className="absolute bottom-4 left-4 bg-card px-4 py-2.5 rounded-xl border border-cardBorder shadow-card z-10">
        <div className="flex items-center gap-4 text-sm text-slate-700">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>High risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Low</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Map
