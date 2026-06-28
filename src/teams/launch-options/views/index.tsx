import { SidebarNavigation, SteamSpinner } from "@decky/ui"
import { useEffect, useMemo, useState } from "react"
import { useSettings } from "../../../hooks"
import { FaPlus, FaTerminal } from "react-icons/fa"
import { PluginProvider } from "../../../components/plugin-provider"
import { CreateLaunchOptionForm } from "../../../components/create-launch-option-form"
import { UpdateLaunchOptionForm } from "../../../components/update-launch-option-form"
import { routes } from "../../../shared"

export function LaunchOptionsPage() {
  const { settings, loading } = useSettings()
  const newLaunchOptionRoute = routes.launchOptionsManagerItem("new")
  const [activePage, setActivePage] = useState<string>(newLaunchOptionRoute)

  const navKey = useMemo(
    () => settings.launchOptions.map(({ id }) => id).join("|"),
    [settings.launchOptions],
  )

  const pageRoutes = useMemo(
    () =>
      new Set<string>([
        newLaunchOptionRoute,
        ...settings.launchOptions.map((item) =>
          routes.launchOptionsManagerItem(item.id),
        ),
      ]),
    [newLaunchOptionRoute, settings.launchOptions],
  )

  useEffect(() => {
    if (!pageRoutes.has(activePage)) {
      setActivePage(newLaunchOptionRoute)
    }
  }, [activePage, newLaunchOptionRoute, pageRoutes])

  return (
    <PluginProvider>
      <div
        style={{
          marginTop: "40px",
          height: "calc(100% - 40px)",
        }}
      >
        {loading ? (
          <SteamSpinner width={"100%"} height={"100%"} />
        ) : (
          <SidebarNavigation
            key={navKey}
            title={"Launch options"}
            showTitle={true}
            disableRouteReporting={true}
            page={activePage}
            onPageRequested={setActivePage}
            pages={[
              {
                icon: <FaPlus />,
                title: "New launch option",
                identifier: "new-launch-option",
                route: routes.launchOptionsManagerItem("new"),
                content: <CreateLaunchOptionForm />,
              },
              ...settings.launchOptions.map(({ id, name }) => ({
                icon: <FaTerminal />,
                title: name || "Unnamed",
                identifier: id,
                route: routes.launchOptionsManagerItem(id),
                content: (
                  <UpdateLaunchOptionForm
                    key={id || ""}
                    id={id}
                    commonOnly={false}
                    syncCommonFields={false}
                  />
                ),
              })),
            ]}
          />
        )}
      </div>
    </PluginProvider>
  )
}
