import { fetchNoCors, toaster } from "@decky/api"
import {
  ButtonItem,
  Focusable,
  PanelSectionRow,
  showModal,
  Tabs,
} from "@decky/ui"
import { useEffect, useRef, useState } from "react"
import { ModalWrapper } from "../../launch-options/components/modal-wrapper"
import { AddStoreForm } from "../add-store-form"
import {
  defaultRecipeStore,
  deleteStore,
  getStores,
  moveStore,
  parseStore,
  SavedStore,
  updateStore,
} from "../store"
import { StoreRecipes } from "../store-recipes"
import { StoreList } from "../store-list"

export function RecipeStorePage() {
  const [tab, setTab] = useState("stores")
  const [readyToShow, setReadyToShow] = useState(true)
  const [stores, setStores] = useState<SavedStore[]>([])
  const [storeError, setStoreError] = useState("")
  const updatingStores = useRef(new Set<string>())
  const activeTab =
    tab === "stores" || stores.some(({ url }) => `store:${url}` === tab)
      ? tab
      : stores[0]
        ? `store:${stores[0].url}`
        : "stores"

  const refreshStores = (selectFirstStore = false) => {
    try {
      const saved = getStores()
      setStores(saved)
      if (selectFirstStore)
        setTab(saved[0] ? `store:${saved[0].url}` : "stores")
      setStoreError("")
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : String(error))
    }
  }
  useEffect(() => refreshStores(true), [])

  const removeStore = (url: string) => {
    try {
      setStores(deleteStore(url))
      setStoreError("")
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : String(error))
    }
  }

  const updateStoreMetadata = async (url: string) => {
    if (updatingStores.current.has(url)) return
    updatingStores.current.add(url)
    setStoreError("")
    try {
      const response = await fetchNoCors(url)
      if (!response.ok)
        throw new Error(`Could not download store (HTTP ${response.status}).`)
      const store = parseStore(await response.json())
      setStores(updateStore(url, store))
      toaster.toast({ title: "Store metadata updated", body: store.name })
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : String(error))
    } finally {
      updatingStores.current.delete(url)
    }
  }

  // Match the per-app page's focus reset when switching Steam tabs.
  useEffect(() => {
    setReadyToShow(false)
    const timeout = window.setTimeout(() => setReadyToShow(true), 100)
    return () => window.clearTimeout(timeout)
  }, [activeTab])

  return (
    <div
      style={{
        marginTop: 40,
        height: "calc(100% - 40px - 42px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs
          activeTab={activeTab}
          onShowTab={setTab}
          autoFocusContents
          tabs={[
            {
              id: "stores",
              title: "Stores",
              content: readyToShow && (
                <Focusable
                  key="stores"
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <PanelSectionRow>
                    <ButtonItem
                      layout="below"
                      onClick={() => {
                        const modal = showModal(
                          <ModalWrapper
                            title="Add recipe store"
                            onClose={() => modal.Close()}
                          >
                            <AddStoreForm
                              hasDefaultStore={stores.some(
                                ({ url }) => url === defaultRecipeStore.url,
                              )}
                              onAdded={() => {
                                refreshStores()
                                modal.Close()
                              }}
                            />
                          </ModalWrapper>,
                        )
                      }}
                    >
                      Add recipe store
                    </ButtonItem>
                  </PanelSectionRow>
                  {storeError && (
                    <div role="alert" style={{ textAlign: "center" }}>
                      {storeError}
                    </div>
                  )}
                  <StoreList
                    stores={stores}
                    onMove={(url, direction) => {
                      try {
                        setStores(moveStore(url, direction))
                        setStoreError("")
                      } catch (error) {
                        setStoreError(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        )
                      }
                    }}
                    onUpdate={(url) => void updateStoreMetadata(url)}
                    onDelete={removeStore}
                  />
                </Focusable>
              ),
            },
            ...stores.map(({ url, store }) => ({
              id: `store:${url}`,
              title: stores.some(
                (other) => other.url !== url && other.store.name === store.name,
              )
                ? `${store.name} (${store.github.branch})`
                : store.name,
              content: readyToShow && (
                <Focusable key={url} style={{ height: "100%" }}>
                  <StoreRecipes store={store} />
                </Focusable>
              ),
            })),
          ]}
        />
      </div>
    </div>
  )
}
