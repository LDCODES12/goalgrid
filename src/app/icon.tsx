import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 16,
          background: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          border: "3px solid #e5e7eb",
        }}
      >
        <span style={{ fontWeight: "bold", color: "#1f2937" }}>GG</span>
      </div>
    ),
    { ...size }
  )
}
