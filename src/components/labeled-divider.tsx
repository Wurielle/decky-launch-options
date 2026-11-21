export function LabeledDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        marginTop: 6,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 100,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.6)",
        }}
      >
        {label}
      </h3>
      <hr
        aria-hidden="true"
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          border: 0,
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      />
    </div>
  )
}
