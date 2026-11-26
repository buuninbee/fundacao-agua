import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Well } from '@/types/mipc'
import {
  classifyWaterStatus,
  formatDecimalBR,
  hasCommunicationFailure,
} from '@/lib/waterRules'

interface WellsMapProps {
  wells: Well[]
  selectedWellId?: string
  onSelectWell?: (well: Well) => void
  heightClassName?: string
  singleFocus?: boolean
}

function getMarkerPalette(well: Well): { fill: string; stroke: string; label: string } {
  const status = classifyWaterStatus(well.currentReading)
  const offline = hasCommunicationFailure(well.lastTransmissionMinutesAgo)
  if (offline) {
    return { fill: '#626569', stroke: '#001325', label: 'Falha de Comunicação' }
  }
  if (status === 'Crítico') {
    return { fill: '#dc2626', stroke: '#7f1d1d', label: 'Crítico' }
  }
  if (status === 'Atenção') {
    return { fill: '#d97706', stroke: '#78350f', label: 'Atenção' }
  }
  return { fill: '#059669', stroke: '#064e3b', label: 'Excelente' }
}

export function WellsMap({
  wells,
  selectedWellId,
  onSelectWell,
  heightClassName = 'h-[360px]',
  singleFocus = false,
}: WellsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [-15.789, -47.99],
      zoom: 14,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    layerGroupRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const group = layerGroupRef.current
    if (!map || !group) return

    group.clearLayers()

    wells.forEach((well) => {
      const palette = getMarkerPalette(well)
      const isSelected = well.id === selectedWellId
      const isCritical = classifyWaterStatus(well.currentReading) === 'Crítico'

      // Outer alert ring for critical or selected well
      if (isCritical || isSelected) {
        L.circleMarker([well.latitude, well.longitude], {
          radius: isSelected ? 18 : 15,
          color: palette.fill,
          weight: 2,
          fillColor: palette.fill,
          fillOpacity: 0.18,
          interactive: false,
        }).addTo(group)
      }

      const marker = L.circleMarker([well.latitude, well.longitude], {
        radius: isSelected ? 10 : 8,
        color: '#ffffff',
        weight: 2.5,
        fillColor: palette.fill,
        fillOpacity: 0.95,
      }).addTo(group)

      const turbRed = well.currentReading.turbidity >= 5
      const phRed = well.currentReading.ph < 6 || well.currentReading.ph > 9.5
      const tempRed = well.currentReading.temperature >= 25

      marker.bindPopup(
        `<div style="min-width:200px;color:#001325;font-size:12px;line-height:1.45;">
          <strong style="font-size:13px;display:block;margin-bottom:2px;">${well.name}</strong>
          <span style="color:#626569;display:block;margin-bottom:6px;">${well.sector}</span>
          <div style="margin-bottom:4px;">Status: <strong style="color:${palette.fill};">${palette.label}</strong></div>
          <div>pH: <strong style="${phRed ? 'color:#dc2626;' : ''}">${formatDecimalBR(well.currentReading.ph)}</strong> ·
          Turbidez: <strong style="${turbRed ? 'color:#dc2626;' : ''}">${formatDecimalBR(well.currentReading.turbidity)} UNT</strong> ·
          Temp.: <strong style="${tempRed ? 'color:#dc2626;' : ''}">${formatDecimalBR(well.currentReading.temperature)} °C</strong></div>
          <div style="margin-top:4px;color:#626569;">Reservatório: ${well.reservoirLevel}% · ~${well.affectedFamilies} famílias</div>
        </div>`,
      )

      marker.on('click', () => {
        onSelectWell?.(well)
      })

      if (isSelected && singleFocus) {
        marker.openPopup()
      }
    })

    if (wells.length === 1) {
      map.setView([wells[0].latitude, wells[0].longitude], 15)
    } else if (wells.length > 1) {
      const bounds = L.latLngBounds(wells.map((w) => [w.latitude, w.longitude]))
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
    }
  }, [wells, selectedWellId, onSelectWell, singleFocus])

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-lg border border-purple-600 bg-purple-200 ${heightClassName}`}
    />
  )
}
