import { fetchNoCors, toaster } from "@decky/api"
import {
  DialogBody,
  DialogButton,
  DialogButtonPrimary,
  DialogFooter,
  DialogHeader,
  Field,
  Focusable,
  ModalRoot,
  showModal,
  SteamSpinner,
} from "@decky/ui"
import {
  QueryClientProvider,
  useQueries,
  useQuery,
} from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { FaCheckCircle } from "react-icons/fa"
import { ActionMenuButton } from "../../components/action-menu-button"
import { importRecipe } from "../../components/batch-add-launch-options"
import { LabeledDivider } from "../../components/labeled-divider"
import {
  LaunchOptionControl,
  LaunchOptionControls,
  LaunchOptionFocusList,
} from "../../components/launch-option-focus"
import { ModalScrollContent } from "../../components/modal-scroll-content"
import { StateMessage } from "../../components/state-message"
import { TabLoading } from "../../components/tab-loading"
import { useSettings } from "../../hooks"
import { queryClient } from "../../queries/settings"
import { launchOptionFactory, type Recipe } from "../../shared"
import { getRecipesUrl, readRecipeCatalog } from "../recipe-store/recipes"
import { getStores } from "../recipe-store/store"
import {
  fetchPresetResource,
  downloadHttpError,
  presetQueryOptions,
} from "./discovery"
import { isPresetSelected, prepareRecipeImport, resolvePreset } from "./model"
import type { AppPreset } from "./model"

function PresetAuthor({ author }: { author: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 14,
        fontWeight: 400,
        color: "#b8bcbf",
      }}
    >
      {author.toLowerCase() === "wurielle" && (
        <FaCheckCircle role="img" aria-label="Verified author" />
      )}
      {author}
    </span>
  )
}

function PresetLoading({ label }: { label: string }) {
  return (
    <div
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
    </div>
  )
}

function readStores() {
  try {
    return { stores: getStores(), error: "" }
  } catch (error) {
    return {
      stores: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function AppPresets({ appid }: { appid: string }) {
  const [configuration, setConfiguration] = useState(readStores)
  const { settings, loading, resetAppLaunchOptionSelection } = useSettings()
  const dialog = useRef<{ Close: () => void } | null>(null)
  const operation = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      operation.current?.abort()
      dialog.current?.Close()
    },
    [appid],
  )
  const queries = useQueries({
    queries: configuration.stores.map((store) =>
      presetQueryOptions(store, appid, fetchNoCors),
    ),
  })
  const pending = queries.some((query) => query.isFetching || query.isPending)
  const stores = configuration.stores.map((source, index) => {
    const query = queries[index]
    return {
      ...source,
      presets: query.data?.presets ?? [],
      errors: [
        ...(query.error ? [query.error.message] : []),
        ...(query.data?.errors ?? []),
      ],
    }
  })
  const hasContent = stores.some(({ presets }) => presets.length > 0)

  return (
    <LaunchOptionFocusList
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
      }}
    >
      <Field childrenLayout="inline" childrenContainerWidth="max">
        <LaunchOptionControls style={{ width: "100%" }}>
          <LaunchOptionControl control="value" style={{ flex: 1, minWidth: 0 }}>
            <DialogButton
              style={{ width: "100%" }}
              disabled={pending}
              onClick={() => {
                setConfiguration(readStores())
                for (const query of queries) void query.refetch()
              }}
            >
              Refresh presets
            </DialogButton>
          </LaunchOptionControl>
          <LaunchOptionControl control="actions">
            <ActionMenuButton
              label="Preset actions"
              disabled={loading}
              actions={[
                {
                  label: "Reset launch options selection",
                  onSelected: () => resetAppLaunchOptionSelection(appid),
                },
              ]}
            />
          </LaunchOptionControl>
        </LaunchOptionControls>
      </Field>
      {pending ? (
        <TabLoading label="Loading presets" />
      ) : (
        <>
          {configuration.error && (
            <StateMessage role="alert">{configuration.error}</StateMessage>
          )}
          {!hasContent && !configuration.error && (
            <StateMessage>No presets found for this app.</StateMessage>
          )}
          {stores.map(({ url, store, presets, errors }) => {
            if (!presets.length) return null
            const sections = [
              {
                label: "Game presets",
                presets: presets.filter((preset) => preset.sourceAppid !== "*"),
              },
              {
                label: "Global presets",
                presets: presets.filter((preset) => preset.sourceAppid === "*"),
              },
            ].filter((section) => section.presets.length > 0)
            return (
              <div key={url}>
                <div style={{ marginTop: "16px" }}>
                  <strong>
                    {store.name}
                    <span
                      style={{
                        marginLeft: 6,
                        color: "oklch(80.9% 0.105 251.813)",
                      }}
                    >
                      {store.github.branch}
                    </span>
                  </strong>
                </div>
                {errors.map((error, index) => (
                  <StateMessage role="alert" key={index}>
                    {error}
                  </StateMessage>
                ))}
                {sections.map((section) => (
                  <section key={section.label} aria-label={section.label}>
                    <LabeledDivider label={section.label} />
                    {section.presets.map((preset) => {
                      let selected = false
                      try {
                        selected = isPresetSelected(preset, settings)
                      } catch {
                        /* Invalid presets are not marked selected. */
                      }
                      return (
                        <Field
                          key={preset.key}
                          childrenLayout="inline"
                          label={
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {preset.name}
                              {selected && (
                                <FaCheckCircle
                                  role="img"
                                  aria-label="Preset selected"
                                  style={{ color: "#a4d007" }}
                                />
                              )}
                            </span>
                          }
                          description={
                            <span
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {preset.description && (
                                <span>{preset.description}</span>
                              )}
                              <PresetAuthor author={preset.author} />
                            </span>
                          }
                        >
                          <DialogButton
                            aria-label={`Use ${preset.name}`}
                            disabled={loading}
                            onClick={() => {
                              operation.current?.abort()
                              operation.current = new AbortController()
                              const modal = showModal(
                                <QueryClientProvider client={queryClient}>
                                  <PresetDialog
                                    preset={preset}
                                    signal={operation.current.signal}
                                    onClose={() => modal.Close()}
                                  />
                                </QueryClientProvider>,
                              )
                              dialog.current = modal
                            }}
                          >
                            Use
                          </DialogButton>
                        </Field>
                      )
                    })}
                  </section>
                ))}
              </div>
            )
          })}
        </>
      )}
    </LaunchOptionFocusList>
  )
}

export function PresetDialog({
  preset,
  signal,
  onClose,
}: {
  preset: AppPreset
  signal: AbortSignal
  onClose: () => void
}) {
  const { settings, loading, savePresetRecipe, applyAppPreset } = useSettings()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const applyButtonRef = useRef<HTMLDivElement>(null)
  const reviewButtonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState("")
  const controller = useRef(new AbortController())
  useEffect(() => {
    const abort = () => controller.current.abort()
    if (signal.aborted) abort()
    signal.addEventListener("abort", abort, { once: true })
    return () => {
      signal.removeEventListener("abort", abort)
      abort()
    }
  }, [signal])
  let resolution: ReturnType<typeof resolvePreset> = {
    selected: [],
    missing: preset.launchOptions,
    protectedOptions: [],
  }
  let invalidPreset = false
  try {
    resolution = resolvePreset(preset, settings)
  } catch {
    invalidPreset = true
  }
  const url = getRecipesUrl(preset.store.store)
  const catalog = useQuery({
    queryKey: ["store-recipes", url],
    staleTime: 60_000,
    retry: false,
    enabled: resolution.missing.length > 0,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const response = await fetchPresetResource(url, fetchNoCors, signal)
      if (!response.ok) throw downloadHttpError(response.status, "recipes")
      return readRecipeCatalog(response)
    },
  })
  const recipes: Recipe[] = catalog.data ?? []
  const previews = recipes
    .filter((recipe) =>
      preset.launchOptions.some(
        (reference) => reference.recipeId === recipe.id,
      ),
    )
    .map((recipe) => prepareRecipeImport(recipe, preset.store, settings))
  const previewOptions = previews
    .flatMap((recipe) => recipe.launchOptions ?? [])
    .map(launchOptionFactory)
  // Check the complete known choices before allowing a subset application, not
  // only the already imported part of a potentially conflicting preset.
  try {
    resolution = resolvePreset(preset, settings, previewOptions)
  } catch {
    invalidPreset = true
  }
  const missingRecipeIds = [
    ...new Set(resolution.missing.map((reference) => reference.recipeId)),
  ]
  const missingRecipes = missingRecipeIds
    .map((id) => recipes.find((recipe) => recipe.id === id))
    .filter((recipe) => recipe !== undefined)
  const unavailableRecipeIds = missingRecipeIds.filter(
    (id) => !recipes.some((recipe) => recipe.id === id),
  )
  const firstAvailableRecipeId = missingRecipes[0]?.id
  const run = async (action: () => Promise<void>) => {
    if (
      loading ||
      invalidPreset ||
      busyRef.current ||
      controller.current.signal.aborted
    )
      return
    busyRef.current = true
    setBusy(true)
    setError("")
    try {
      await action()
    } catch (error) {
      if (!controller.current.signal.aborted)
        setError(error instanceof Error ? error.message : String(error))
    } finally {
      busyRef.current = false
      if (!controller.current.signal.aborted) setBusy(false)
    }
  }
  return (
    <ModalRoot
      onCancel={() => {
        controller.current.abort()
        onClose()
      }}
      bAllowFullSize
    >
      <Focusable flow-children="column">
        <DialogHeader
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>{preset.name} Preset</span>
          <PresetAuthor author={preset.author} />
        </DialogHeader>
        <DialogBody
          style={{
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <ModalScrollContent
            onFocusNext={() =>
              (reviewButtonRef.current ?? applyButtonRef.current)?.focus()
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {preset.description && (
                <p style={{ margin: "0 0 12px", fontSize: 16 }}>
                  {preset.description}
                </p>
              )}
              {preset.notes.length > 0 && (
                <>
                  <div>Notes:</div>
                  <ul
                    aria-label="Preset notes"
                    style={{
                      margin: "0 0 12px",
                      paddingLeft: 24,
                      lineHeight: 1.5,
                    }}
                  >
                    {preset.notes.map((note, index) => (
                      <li key={index} style={{ whiteSpace: "pre-line" }}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {preset.launchOptions.length > 0 && (
                <>
                  <div>Launch options:</div>
                  <ul
                    aria-label="Preset launch options"
                    style={{
                      margin: "0 0 12px",
                      paddingLeft: 24,
                      lineHeight: 1.5,
                    }}
                  >
                    {preset.launchOptions.map((reference) => {
                      const option =
                        resolution.selected.find(
                          (option) =>
                            option.source?.recipeId === reference.recipeId &&
                            option.source.launchOptionId ===
                              reference.launchOptionId,
                        ) ??
                        previews
                          .flatMap((recipe) => recipe.launchOptions ?? [])
                          .find(
                            (option) =>
                              option.source?.recipeId === reference.recipeId &&
                              option.source.launchOptionId ===
                                reference.launchOptionId,
                          )
                      const skipped = resolution.protectedOptions.some(
                        (item) => item.reference === reference,
                      )
                      return (
                        <li key={JSON.stringify(reference)}>
                          {option?.name || reference.launchOptionId}
                          {option?.valueName ? ` (${option.valueName})` : ""}
                          {resolution.missing.includes(reference) && (
                            <span> — Not imported</span>
                          )}
                          {skipped && <span> — Skipped</span>}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
            {resolution.missing.length > 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  Some launch options have not been imported yet. Add their
                  corresponding recipes to import them.
                </div>
                {catalog.isFetching && (
                  <PresetLoading label="Loading referenced recipes" />
                )}
                {!catalog.isFetching && unavailableRecipeIds.length > 0 && (
                  <div>
                    <div>Recipes unavailable:</div>
                    <ul
                      aria-label="Unavailable recipes"
                      style={{ margin: 0, paddingLeft: 24, lineHeight: 1.5 }}
                    >
                      {unavailableRecipeIds.map((recipeId) => (
                        <li key={recipeId}>{recipeId}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {resolution.missing.length > 0 && catalog.error && (
              <StateMessage role="alert">{catalog.error.message}</StateMessage>
            )}
            {error && <StateMessage role="alert">{error}</StateMessage>}
          </ModalScrollContent>
          {missingRecipes.length > 0 && (
            <Focusable
              flow-children="column"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 12,
              }}
            >
              {missingRecipes.map((recipe) => (
                <DialogButton
                  ref={
                    recipe.id === firstAvailableRecipeId
                      ? reviewButtonRef
                      : undefined
                  }
                  key={recipe.id}
                  disabled={busy || loading || invalidPreset}
                  onClick={() =>
                    void run(async () => {
                      await importRecipe(
                        prepareRecipeImport(recipe, preset.store, settings),
                        {
                          save: savePresetRecipe,
                          signal: controller.current.signal,
                        },
                      )
                    })
                  }
                >{`Add ${recipe.name} recipe`}</DialogButton>
              ))}
            </Focusable>
          )}
        </DialogBody>
        <DialogFooter style={{ paddingTop: 24 }}>
          <Focusable
            flow-children="column"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <DialogButtonPrimary
              style={{ flex: 1 }}
              ref={applyButtonRef}
              disabled={loading || busy || invalidPreset}
              onClick={() =>
                void run(async () => {
                  const outcome = await applyAppPreset(preset, previewOptions)
                  if (controller.current.signal.aborted) return
                  onClose()
                  toaster.toast({
                    title: `Applied ${preset.name} preset`,
                    body: `${outcome.selected} launch option${outcome.selected === 1 ? "" : "s"} applied`,
                  })
                })
              }
            >
              {resolution.missing.length
                ? "Apply preset anyway"
                : "Apply preset"}
            </DialogButtonPrimary>
            <DialogButton
              style={{ flex: 1 }}
              onClick={() => {
                controller.current.abort()
                onClose()
              }}
            >
              Close
            </DialogButton>
          </Focusable>
        </DialogFooter>
      </Focusable>
    </ModalRoot>
  )
}
