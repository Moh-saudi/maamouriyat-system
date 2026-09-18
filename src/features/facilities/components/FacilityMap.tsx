'use client'

import { useEffect, useRef, useState } from 'react'
import type { V2FacilityDirectoryItem } from '@/features/facilities/types'

type LatLng = {
  lat: number
  lng: number
}

type LeafletMarker = {
  addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletMarker
  bindPopup: (html: string) => LeafletMarker
  on: (event: string, handler: () => void) => LeafletMarker
  openPopup: () => void
  getLatLng: () => LatLng
  setStyle: (style: Record<string, unknown>) => void
  remove: () => void
}

type LeafletLayerGroup = {
  addTo: (map: LeafletMap) => LeafletLayerGroup
  clearLayers: () => void
}

type LeafletMap = {
  setView: (
    center: [number, number],
    zoom: number,
    options?: Record<string, unknown>
  ) => LeafletMap
  fitBounds: (
    bounds: unknown,
    options?: Record<string, unknown>
  ) => LeafletMap
  on: (
    event: string,
    handler: (event: { latlng: LatLng }) => void
  ) => LeafletMap
  invalidateSize: () => void
}

type LeafletNamespace = {
  map: (
    element: HTMLElement,
    options?: Record<string, unknown>
  ) => LeafletMap
  tileLayer: (
    url: string,
    options?: Record<string, unknown>
  ) => { addTo: (map: LeafletMap) => unknown }
  circleMarker: (
    point: [number, number],
    options?: Record<string, unknown>
  ) => LeafletMarker
  layerGroup: () => LeafletLayerGroup
  latLngBounds: (points: Array<[number, number]>) => unknown
  control: {
    zoom: (
      options?: Record<string, unknown>
    ) => { addTo: (map: LeafletMap) => unknown }
  }
}

declare global {
  interface Window {
    L?: LeafletNamespace
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function validCoordinates(item: V2FacilityDirectoryItem): boolean {
  return (
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude) &&
    item.latitude >= -90 &&
    item.latitude <= 90 &&
    item.longitude >= -180 &&
    item.longitude <= 180
  )
}

interface FacilityMapProps {
  facilities: readonly V2FacilityDirectoryItem[]
  selectedFacilityId: string | null
  onSelectFacility: (facilityId: string) => void
  onMapLocationPick?: (latitude: number, longitude: number) => void
  pickingLocation?: boolean
  pickedLocation?: { latitude: number; longitude: number } | null
}

export function FacilityMap({
  facilities,
  selectedFacilityId,
  onSelectFacility,
  onMapLocationPick,
  pickingLocation = false,
  pickedLocation = null,
}: FacilityMapProps) {
  const [leafletReady, setLeafletReady] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null)
  const markersRef = useRef(new Map<string, LeafletMarker>())
  const pickedMarkerRef = useRef<LeafletMarker | null>(null)
  const clickCallbackRef = useRef(onMapLocationPick)
  const pickingLocationRef = useRef(pickingLocation)

  clickCallbackRef.current = onMapLocationPick
  pickingLocationRef.current = pickingLocation

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.L) {
      setLeafletReady(true)
      return
    }

    const existingCss = document.querySelector(
      'link[data-v2-leaflet="true"]'
    )

    if (!existingCss) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href =
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
      link.crossOrigin = ''
      link.dataset.v2Leaflet = 'true'
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector(
      'script[data-v2-leaflet="true"]'
    ) as HTMLScriptElement | null

    if (!existingScript) {
      const script = document.createElement('script')
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
      script.crossOrigin = ''
      script.dataset.v2Leaflet = 'true'
      script.onload = () => setLeafletReady(true)
      document.head.appendChild(script)
      return
    }

    const interval = window.setInterval(() => {
      if (window.L) {
        window.clearInterval(interval)
        setLeafletReady(true)
      }
    }, 100)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || !window.L) return

    const L = window.L

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([27.7, 30.8], 6)

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        }
      ).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      map.on('click', (event) => {
        if (!pickingLocationRef.current || !clickCallbackRef.current) return
        clickCallbackRef.current(event.latlng.lat, event.latlng.lng)
      })

      mapRef.current = map
      markerLayerRef.current = L.layerGroup().addTo(map)

      window.setTimeout(() => map.invalidateSize(), 50)
    }
  }, [leafletReady])

  useEffect(() => {
    if (
      !leafletReady ||
      !window.L ||
      !mapRef.current ||
      !markerLayerRef.current
    ) {
      return
    }

    const L = window.L
    const map = mapRef.current
    const layer = markerLayerRef.current

    layer.clearLayers()
    markersRef.current.clear()

    const plotted = facilities.filter(validCoordinates)

    for (const facility of plotted) {
      const selected = facility.id === selectedFacilityId
      const marker = L.circleMarker(
        [facility.latitude, facility.longitude],
        {
          radius: selected ? 7 : 4,
          weight: selected ? 3 : 1.5,
          color: selected ? '#0f766e' : '#ffffff',
          fillColor: facility.isActive ? '#0f766e' : '#64748b',
          fillOpacity: selected ? 1 : 0.82,
        }
      )

      const lastVisit = facility.lastVisitAt
        ? new Date(facility.lastVisitAt).toLocaleDateString('en-GB')
        : 'لا توجد زيارة منفذة'

      marker
        .bindPopup(
          `<div style="direction:rtl;text-align:right;min-width:210px;font-family:system-ui,sans-serif">
            <strong style="display:block;font-size:13px;color:#0f172a;margin-bottom:5px">${escapeHtml(facility.name)}</strong>
            <span style="display:inline-block;font-size:10px;background:#f1f5f9;color:#475569;border-radius:999px;padding:3px 7px;margin-bottom:6px">${escapeHtml(facility.facilityTypeLabel)}</span>
            <div style="font-size:11px;color:#64748b;line-height:1.6">
              ${escapeHtml(facility.governorate)} · ${escapeHtml(facility.healthAdmin)}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:5px;border-top:1px solid #e2e8f0;padding-top:5px">
              مرات المرور: <strong>${facility.visitCount.toLocaleString('en-US')}</strong><br/>
              آخر مرور: ${escapeHtml(lastVisit)}
            </div>
          </div>`
        )
        .on('click', () => onSelectFacility(facility.id))
        .addTo(layer)

      markersRef.current.set(facility.id, marker)
    }

    if (plotted.length > 0 && !selectedFacilityId) {
      const bounds = L.latLngBounds(
        plotted.map((item) => [item.latitude, item.longitude])
      )
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: plotted.length === 1 ? 14 : 11,
      })
    }
  }, [
    leafletReady,
    facilities,
    selectedFacilityId,
    onSelectFacility,
  ])

  useEffect(() => {
    if (!leafletReady || !window.L || !mapRef.current) return

    const selected = selectedFacilityId
      ? facilities.find((item) => item.id === selectedFacilityId)
      : null

    if (!selected || !validCoordinates(selected)) return

    mapRef.current.setView(
      [selected.latitude, selected.longitude],
      14,
      { animate: true }
    )

    markersRef.current.get(selected.id)?.openPopup()
  }, [leafletReady, selectedFacilityId, facilities])

  useEffect(() => {
    if (!leafletReady || !window.L || !mapRef.current) return

    pickedMarkerRef.current?.remove()
    pickedMarkerRef.current = null

    if (!pickedLocation) return

    pickedMarkerRef.current = window.L
      .circleMarker(
        [pickedLocation.latitude, pickedLocation.longitude],
        {
          radius: 8,
          weight: 3,
          color: '#ffffff',
          fillColor: '#f59e0b',
          fillOpacity: 1,
        }
      )
      .addTo(mapRef.current)

    mapRef.current.setView(
      [pickedLocation.latitude, pickedLocation.longitude],
      15,
      { animate: true }
    )
  }, [leafletReady, pickedLocation])

  return (
    <div className="relative h-full min-h-[430px] w-full overflow-hidden rounded-xl bg-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {!leafletReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 text-xs font-semibold text-slate-500">
          جارٍ تحميل الخريطة التفاعلية...
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
        <p className="text-[10px] font-bold text-slate-700">
          {facilities.length.toLocaleString('en-US')} منشأة على الخريطة
        </p>
        {pickingLocation && (
          <p className="mt-1 text-[9px] font-semibold text-amber-700">
            انقر على الخريطة لتحديد موقع المنشأة
          </p>
        )}
      </div>
    </div>
  )
}
