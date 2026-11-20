import { SteamSpinner } from "@decky/ui"

export function TabLoading({ label }: { label: string }) {
  return (
    <div
      data-dlo-tab-loading
      role="status"
      aria-label={label}
      style={{
        flex: 1,
        minHeight: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SteamSpinner
        background="transparent"
        style={{ width: 64, height: 64 }}
      />
      <style>{`
        ._TabContentsScroll:has([data-dlo-tab-loading]) {
          padding-bottom: 0;
        }
      `}</style>
    </div>
  )
}
