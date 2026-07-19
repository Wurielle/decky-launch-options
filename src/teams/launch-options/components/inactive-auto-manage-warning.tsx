export function InactiveAutoManageWarning({
  isNonSteamApp,
}: {
  isNonSteamApp: boolean
}) {
  return (
    <div
      style={{
        marginBottom: 6,
        padding: 12,
        borderRadius: 4,
        border: "1px solid rgba(245, 158, 11, 0.55)",
        background: "rgba(120, 53, 15, 0.35)",
        color: "rgb(253, 230, 138)",
        lineHeight: 1.35,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div>
        <strong>Inactive</strong>
      </div>
      <div>
        {isNonSteamApp
          ? "Auto-manage Non-Steam App Launch Options"
          : "Auto-manage Steam App Launch Options"}{" "}
        is off and the DLO command is not present in the app's launch options.
      </div>
    </div>
  )
}
