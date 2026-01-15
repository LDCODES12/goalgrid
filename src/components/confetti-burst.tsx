"use client"

import { useMemo } from "react"

const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"]

export function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, index) => ({
        id: index,
        left: Math.random() * 120 - 10,
        delay: Math.random() * 120,
        rotate: Math.random() * 90 - 45,
        color: colors[index % colors.length],
      })),
    []
  )

  return (
    <div className="confetti-burst absolute -right-1 top-1/2 h-1 w-1">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}px`,
            top: "-12px",
            background: piece.color,
            transform: `rotate(${piece.rotate}deg)`,
            animationDelay: `${piece.delay}ms`,
          }}
        />
      ))}
    </div>
  )
}
