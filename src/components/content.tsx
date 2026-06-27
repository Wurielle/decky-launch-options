import {
  DialogBody,
  ModalRoot,
  ScrollPanel,
} from "@decky/ui";
import { useEffect, useState } from "react";
import { get_debug_log } from "../query";

export function DebugLogModal({ onClose }: { onClose: () => void }) {
  const [log, setLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get_debug_log().then((result) => {
      setLog(result);
      setLoading(false);
    });
  }, []);

  return (
    <ModalRoot onCancel={onClose}>
      <DialogBody>
        <ScrollPanel>
          {loading ? (
            <div>Loading...</div>
          ) : log ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {log}
            </pre>
          ) : (
            <div>No debug log found. Launch a game to generate one.</div>
          )}
        </ScrollPanel>
      </DialogBody>
    </ModalRoot>
  );
}

