import { DialogBody, SidebarNavigation, SteamSpinner } from "@decky/ui"
import { useEffect, useMemo, useState } from "react"
import { FaPlus, FaCodeBranch } from "react-icons/fa"
import { PluginProvider } from "../../../components/plugin-provider"
import { CreateEnvironmentVariableMergeForm } from "../../../components/create-environment-variable-merge-form"
import { UpdateEnvironmentVariableMergeForm } from "../../../components/update-environment-variable-merge-form"
import { useSettings } from "../../../hooks"
import { routes } from "../../../shared"

export function EnvironmentVariableMergesPage() {
  const { settings, loading } = useSettings()
  const newEnvironmentVariableMergeRoute =
    routes.environmentVariableMergesManagerItem("new")
  const [activePage, setActivePage] = useState<string>(
    newEnvironmentVariableMergeRoute,
  )

  const navKey = useMemo(
    () => settings.environmentVariableMerges.map(({ id }) => id).join("|"),
    [settings.environmentVariableMerges],
  )

  const pageRoutes = useMemo(
    () =>
      new Set<string>([
        newEnvironmentVariableMergeRoute,
        ...settings.environmentVariableMerges.map((item) =>
          routes.environmentVariableMergesManagerItem(item.id),
        ),
      ]),
    [newEnvironmentVariableMergeRoute, settings.environmentVariableMerges],
  )

  useEffect(() => {
    if (!pageRoutes.has(activePage)) {
      setActivePage(newEnvironmentVariableMergeRoute)
    }
  }, [activePage, newEnvironmentVariableMergeRoute, pageRoutes])

  return (
    <PluginProvider>
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
              identifier: "new-environment-variable-merge",
              route: routes.environmentVariableMergesManagerItem("new"),
              content: (
                <DialogBody>
                  <CreateEnvironmentVariableMergeForm />
                </DialogBody>
              ),
            },
            ...settings.environmentVariableMerges.map(({ id, name }) => ({
              icon: <FaCodeBranch />,
              title: name || "Unnamed",
              identifier: id,
              route: routes.environmentVariableMergesManagerItem(id),
              content: (
                <DialogBody>
                  <UpdateEnvironmentVariableMergeForm key={id || ""} id={id} />
                </DialogBody>
              ),
            })),
          ]}
        />
      )}
    </PluginProvider>
  )
}
