import { SidebarNavigation, SteamSpinner } from "@decky/ui"
import { useEffect, useMemo, useState } from "react"
import { FaPlus, FaCodeBranch } from "react-icons/fa"
import { PluginProvider } from "../../../components/plugin-provider"
import { CreateEnvVariableMergeForm } from "../../../components/create-env-variable-merge-form"
import { UpdateEnvVariableMergeForm } from "../../../components/update-env-variable-merge-form"
import { useSettings } from "../../../hooks"
import { routes } from "../../../shared"

export function EnvVariableMergesPage() {
  const { settings, loading } = useSettings()
  const newEnvVariableMergeRoute = routes.envVariableMergesManagerItem("new")
  const [activePage, setActivePage] = useState<string>(newEnvVariableMergeRoute)

  const navKey = useMemo(
    () => settings.envVariableMerges.map(({ id }) => id).join("|"),
    [settings.envVariableMerges],
  )

  const pageRoutes = useMemo(
    () =>
      new Set<string>([
        newEnvVariableMergeRoute,
        ...settings.envVariableMerges.map((item) =>
          routes.envVariableMergesManagerItem(item.id),
        ),
      ]),
    [newEnvVariableMergeRoute, settings.envVariableMerges],
  )

  useEffect(() => {
    if (!pageRoutes.has(activePage)) {
      setActivePage(newEnvVariableMergeRoute)
    }
  }, [activePage, newEnvVariableMergeRoute, pageRoutes])

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
            title={"Environment variable merges"}
            showTitle={true}
            disableRouteReporting={true}
            page={activePage}
            onPageRequested={setActivePage}
            pages={[
              {
                icon: <FaPlus />,
                title: "New merge",
                identifier: "new-env-variable-merge",
                route: routes.envVariableMergesManagerItem("new"),
                content: <CreateEnvVariableMergeForm />,
              },
              ...settings.envVariableMerges.map(({ id, name }) => ({
                icon: <FaCodeBranch />,
                title: name || "Unnamed",
                identifier: id,
                route: routes.envVariableMergesManagerItem(id),
                content: <UpdateEnvVariableMergeForm key={id || ""} id={id} />,
              })),
            ]}
          />
        )}
      </div>
    </PluginProvider>
  )
}
