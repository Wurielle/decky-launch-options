import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  Navigation,
} from "@decky/ui";
import {
  callable,
  definePlugin,
    routerHook,
} from "@decky/api"
import { FaTerminal } from "react-icons/fa";
import { ROUTES } from './consts'
import { LaunchOptionsPage } from './teams/launch-options/views'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()

const applyLaunchOptions = callable<[], void>("apply_launch_options");
const restartSteam = callable<[], void>("restart_steam");
const printDebugLogs = callable<[], void>("debug_logs");
const startWatcher = callable<[], void>("start_watcher");
const stopWatcher = callable<[], void>("stop_watcher");

function Content() {
  return (
    <PanelSection title="Panel Section">
        <PanelSectionRow>
            <ButtonItem
                layout="below"
                onClick={() => {
                    Navigation.Navigate("/launch-options");
                    Navigation.CloseSideMenus();
                }}
            >
                Manage launch options
            </ButtonItem>
        </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => applyLaunchOptions()}
        >
          {'Apply Launch Options'}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => restartSteam()}
        >
          {'Restart Steam'}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
            layout="below"
            onClick={() => printDebugLogs()}
        >
          Print debug logs
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
            layout="below"
            onClick={() => startWatcher()}
        >
          Start watcher
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
            layout="below"
            onClick={() => stopWatcher()}
        >
          Stop watcher
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
};

export default definePlugin(() => {
    routerHook.removeRoute(ROUTES.LAUNCH_OPTIONS)
    routerHook.addRoute(ROUTES.LAUNCH_OPTIONS, () => {
        return (
            <QueryClientProvider client={queryClient}>
                <LaunchOptionsPage/>
            </QueryClientProvider>
        ) ;
    });
  return {
    name: "Launch Options",
    titleView: <div className={staticClasses.Title}>Launch Options</div>,
    content: <Content />,
    icon: <FaTerminal />,
    onDismount() {
        Object.values(ROUTES).forEach((route) => {
            routerHook.removeRoute(route)
        })
    },
  };
});
