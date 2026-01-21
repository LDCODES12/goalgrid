"use client"

import { useEffect } from "react"

interface DynamicFaviconProps {
  completionPercent: number // 0-100
  points: number
}

export function DynamicFavicon({ completionPercent, points }: DynamicFaviconProps) {
  useEffect(() => {
    const updateFavicon = () => {
      const size = 128 // Higher res for crisp display at all sizes
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const center = size / 2
      const radius = size / 2 - 12
      const lineWidth = 10
      const progress = Math.min(100, Math.max(0, completionPercent)) / 100

      // Solid dark background for better contrast
      ctx.fillStyle = "#0F172A" // slate-900
      ctx.beginPath()
      ctx.arc(center, center, size / 2, 0, 2 * Math.PI)
      ctx.fill()

      // Background track - subtle but visible
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = "#334155" // slate-700
      ctx.lineWidth = lineWidth
      ctx.stroke()

      // Progress arc with smooth colors
      if (progress > 0) {
        ctx.beginPath()
        ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI)

        // Modern gradient colors based on progress
        if (progress >= 0.8) {
          ctx.strokeStyle = "#10B981" // emerald-500 - excellent progress
        } else if (progress >= 0.6) {
          ctx.strokeStyle = "#3B82F6" // blue-500 - good progress
        } else if (progress >= 0.3) {
          ctx.strokeStyle = "#F59E0B" // amber-500 - some progress
        } else {
          ctx.strokeStyle = "#64748B" // slate-500 - minimal progress
        }
        ctx.lineWidth = lineWidth
        ctx.lineCap = "round"
        ctx.stroke()
      }

      // Percentage number - clean, readable typography
      const pct = Math.round(completionPercent)
      ctx.fillStyle = "#FFFFFF" // Pure white for maximum contrast

      // Font size adapts to number length
      const fontSize = pct === 100 ? 36 : 44
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      // Add subtle shadow for better legibility
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 1

      ctx.fillText(String(pct), center, center + 2)

      // Reset shadow
      ctx.shadowColor = "transparent"
      ctx.shadowBlur = 0

      // Set favicon
      const dataUrl = canvas.toDataURL("image/png")

      // Update or create favicon
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement("link")
        link.rel = "icon"
        link.type = "image/png"
        document.head.appendChild(link)
      }
      link.href = dataUrl
    }

    updateFavicon()
    const timer = setTimeout(updateFavicon, 300)

    return () => clearTimeout(timer)
  }, [completionPercent, points])

  return null
}
