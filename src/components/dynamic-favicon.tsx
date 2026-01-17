"use client"

import { useEffect } from "react"

interface DynamicFaviconProps {
  completionPercent: number // 0-100
  points: number
}

export function DynamicFavicon({ completionPercent, points }: DynamicFaviconProps) {
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 32
        canvas.height = 32
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const size = 32

        // Clear canvas with white background
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, size, size)

        // Background circle (track)
        const centerX = size / 2
        const centerY = size / 2
        const radius = 12
        const lineWidth = 4

        // Draw background track
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.strokeStyle = "#d1d5db" // gray-300
        ctx.lineWidth = lineWidth
        ctx.stroke()

        // Draw progress arc
        const progress = Math.min(100, Math.max(0, completionPercent)) / 100
        const startAngle = -Math.PI / 2 // Start from top
        const endAngle = startAngle + progress * 2 * Math.PI

        if (progress > 0) {
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, startAngle, endAngle)
          // Color based on progress
          if (progress >= 0.66) {
            ctx.strokeStyle = "#22c55e" // green-500
          } else if (progress >= 0.33) {
            ctx.strokeStyle = "#eab308" // yellow-500
          } else {
            ctx.strokeStyle = "#ef4444" // red-500
          }
          ctx.lineWidth = lineWidth
          ctx.lineCap = "round"
          ctx.stroke()
        }

        // Draw percentage text in center
        ctx.fillStyle = "#374151" // gray-700
        ctx.font = "bold 10px Arial, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`${Math.round(completionPercent)}`, centerX, centerY)

        // Convert canvas to favicon data URL
        const faviconUrl = canvas.toDataURL("image/png")

        // Update favicon - find existing or create new
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/png"]')
        if (!link) {
          // Remove any other icon links first
          document.querySelectorAll('link[rel="icon"]').forEach(el => el.remove())
          link = document.createElement("link")
          link.rel = "icon"
          link.type = "image/png"
          document.head.appendChild(link)
        }
        link.href = faviconUrl
      } catch (e) {
        console.error("Failed to update favicon:", e)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [completionPercent, points])

  return null
}
