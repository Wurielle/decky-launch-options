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
} from "@decky/api"
import { FaTerminal } from "react-icons/fa";

import logo from "../assets/logo.png";

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

      <PanelSectionRow>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <img src={logo} />
        </div>
      </PanelSectionRow>

      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => {
            Navigation.Navigate("/decky-plugin-test");
            Navigation.CloseSideMenus();
          }}
        >
          Router
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
};

export default definePlugin(() => {
  return {
    name: "Launch Options",
    titleView: <div className={staticClasses.Title}>Launch Options</div>,
    content: <Content />,
    icon: <FaTerminal />,
    onDismount() {
    },
  };
});
