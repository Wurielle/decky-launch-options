import { DialogButton, Field } from "@decky/ui"
import { useState } from "react"
import { FaArrowDown, FaArrowUp } from "react-icons/fa"
import { ActionMenuButton } from "../../components/action-menu-button"
import {
  LaunchOptionControl,
  LaunchOptionControls,
  LaunchOptionFocusProvider,
  useLaunchOptionFocus,
} from "../../components/launch-option-focus"
import { defaultRecipeStore, type SavedStore } from "./store"

interface StoreListProps {
  stores: SavedStore[]
  onMove: (url: string, direction: -1 | 1) => void
  onUpdate: (url: string) => void
  onDelete: (url: string) => void
}

export function StoreList(props: StoreListProps) {
  return (
    <LaunchOptionFocusProvider>
      <StoreRows {...props} />
    </LaunchOptionFocusProvider>
  )
}

function StoreRows({ stores, onMove, onUpdate, onDelete }: StoreListProps) {
  const { setControl } = useLaunchOptionFocus()
  const [focusTarget, setFocusTarget] = useState<{
    url: string
    version: number
  } | null>(null)

  return (
    <div key={focusTarget?.version ?? 0}>
      {stores.map(({ url, store }, index) => (
        <Field
          key={url}
          label={
            <span>
              {store.name}
              {store.type === "github" && (
                <span
                  style={{
                    marginLeft: 6,
                    color: "oklch(80.9% 0.105 251.813)",
                  }}
                >
                  {store.github.branch}
                </span>
              )}
            </span>
          }
          description={store.description}
          childrenLayout="inline"
        >
          <LaunchOptionControls autoFocus={focusTarget?.url === url}>
            {([-1, 1] as const).map((direction) => {
              const target = stores[index + direction]
              const Icon = direction === -1 ? FaArrowUp : FaArrowDown
              const action = direction === -1 ? "up" : "down"

              return (
                <LaunchOptionControl key={direction} control={action}>
                  <DialogButton
                    aria-label={`Move ${store.name} ${action}`}
                    disabled={!target}
                    style={{
                      minWidth: 40,
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={() => {
                      if (!target) return
                      const canMoveAgain = !!stores[index + 2 * direction]
                      setControl(
                        canMoveAgain ? action : action === "up" ? "down" : "up",
                      )
                      setFocusTarget((previous) => ({
                        url,
                        version: (previous?.version ?? 0) + 1,
                      }))
                      onMove(url, direction)
                    }}
                  >
                    <Icon />
                  </DialogButton>
                </LaunchOptionControl>
              )
            })}
            <LaunchOptionControl control="actions">
              <ActionMenuButton
                label={`Actions for ${store.name}`}
                actions={[
                  {
                    label: "Update store metadata",
                    onSelected: () => onUpdate(url),
                  },
                  ...(url === defaultRecipeStore.url
                    ? []
                    : [
                        {
                          label: "Delete",
                          tone: "destructive" as const,
                          onSelected: () => onDelete(url),
                        },
                      ]),
                ]}
              />
            </LaunchOptionControl>
          </LaunchOptionControls>
        </Field>
      ))}
    </div>
  )
}
