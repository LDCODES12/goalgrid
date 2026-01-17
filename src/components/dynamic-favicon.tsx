"use client"

import { useEffect } from "react"

interface DynamicFaviconProps {
  completionPercent: number // 0-100
  points: number
}

export function DynamicFavicon({ completionPercent, points }: DynamicFaviconProps) {
  useEffect(() => {
    const updateFavicon = () => {
      const size = 64 // Higher res for crisp display
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const center = size / 2
      const radius = size / 2 - 6
      const lineWidth = 6
      const progress = Math.min(100, Math.max(0, completionPercent)) / 100

      // Transparent background with subtle fill
      ctx.fillStyle = "#f8fafc"
      ctx.beginPath()
      ctx.arc(center, center, size / 2, 0, 2 * Math.PI)
      ctx.fill()

      // Background track - subtle
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = "#e2e8f0"
      ctx.lineWidth = lineWidth
      ctx.stroke()

      // Progress arc with gradient effect
      if (progress > 0) {
        ctx.beginPath()
        ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI)
        
        // Modern gradient colors based on progress
        if (progress >= 0.8) {
          ctx.strokeStyle = "#10b981" // emerald-500
        } else if (progress >= 0.5) {
          ctx.strokeStyle = "#3b82f6" // blue-500
        } else if (progress >= 0.25) {
          ctx.strokeStyle = "#f59e0b" // amber-500
        } else {
          ctx.strokeStyle = "#64748b" // slate-500
        }
        ctx.lineWidth = lineWidth
        ctx.lineCap = "round"
        ctx.stroke()
      }

      // Percentage number - clean typography
      const pct = Math.round(completionPercent)
      ctx.fillStyle = "#0f172a" // slate-900
      ctx.font = `bold ${pct === 100 ? 18 : 22}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(pct), center, center)

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
