import type { ReactNode } from "react"

export function StateMessage({
  children,
  role,
}: {
  children: ReactNode
  role?: "alert" | "status"
}) {
  return (
    <div
      role={role}
      style={{
        padding: "12px 0",
        textAlign: "center",
        whiteSpace: "pre-line",
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </div>
  )
}
