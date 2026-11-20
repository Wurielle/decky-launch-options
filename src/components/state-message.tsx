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
        textAlign: "center",
        whiteSpace: "pre-line",
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </div>
  )
}
