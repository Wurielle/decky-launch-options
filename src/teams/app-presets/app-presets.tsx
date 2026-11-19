import { fetchNoCors } from "@decky/api"
import {
  ButtonItem,
  DialogBody,
  DialogButton,
  DialogButtonPrimary,
  DialogFooter,
  DialogHeader,
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
import { importRecipe } from "../../components/batch-add-launch-options"
import { LaunchOptionFocusList } from "../../components/launch-option-focus"
import { ModalScrollContent } from "../../components/modal-scroll-content"
import { useSettings } from "../../hooks"
import { queryClient } from "../../queries/settings"
import { launchOptionFactory, type Recipe } from "../../shared"
import { getLaunchOptionState } from "../../utils/settings"
import { getRecipesUrl, parseRecipes } from "../recipe-store/recipes"
import { getStores } from "../recipe-store/store"
import {
  fetchPresetResource,
  presetHttpError,
  presetQueryOptions,
} from "./discovery"
import {
  isPresetSelected,
  prepareRecipeImport,
  resolvePreset,
  storeKey,
} from "./model"
import type { AppPreset, PresetSkip } from "./model"

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
  const { settings, loading } = useSettings()
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
  const presets = queries.flatMap((query) => query.data?.presets ?? [])
  const errors = queries.flatMap((query, index) =>
    [
      ...(query.error ? [query.error.message] : []),
      ...(query.data?.errors ?? []),
    ].map((message) => `${configuration.stores[index].store.name}: ${message}`),
  )

  return (
    <LaunchOptionFocusList style={{ height: "100%" }}>
      <DialogButton
        disabled={pending}
        onClick={() => {
          setConfiguration(readStores())
          for (const query of queries) void query.refetch()
        }}
      >
        Refresh presets
      </DialogButton>
      {configuration.error && <div role="alert">{configuration.error}</div>}
      {pending && (
        <div role="status" aria-label="Loading presets">
          <SteamSpinner />
        </div>
      )}
      {errors.map((error, index) => (
        <div role="alert" key={index}>
          {error}
        </div>
      ))}
      {!pending &&
        !presets.length &&
        !errors.length &&
        !configuration.error && <p>No presets found for this app.</p>}
      {presets.map((preset) => {
        let selected = false
        try {
          selected = isPresetSelected(preset, settings)
        } catch {
          /* The review dialog explains invalid references. */
        }
        return (
          <div key={preset.key}>
            <ButtonItem
              disabled={loading}
              description={
                <>
                  <div>{preset.description}</div>
                  <div>
                    {preset.store.store.name} ·{" "}
                    {preset.store.store.github.repository} ·{" "}
                    {preset.store.store.github.branch}
                  </div>
                </>
              }
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
              {preset.name}
            </ButtonItem>
            {selected && (
              <FaCheckCircle
                role="img"
                aria-label="Preset selected"
                style={{ color: "#a4d007" }}
              />
            )}
          </div>
        )
      })}
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
  const [result, setResult] = useState<{
    selected: number
    skipped: PresetSkip[]
  } | null>(null)
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
  let validationError = ""
  try {
    resolution = resolvePreset(preset, settings)
  } catch (error) {
    validationError = error instanceof Error ? error.message : String(error)
  }
  const url = getRecipesUrl(preset.store.store)
  const catalog = useQuery({
    queryKey: ["store-recipes", url],
    staleTime: 60_000,
    retry: false,
    enabled: resolution.missing.length > 0,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const response = await fetchPresetResource(url, fetchNoCors, signal)
      if (!response.ok) throw presetHttpError(response.status)
      return parseRecipes(await response.json())
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
  } catch (error) {
    validationError = error instanceof Error ? error.message : String(error)
  }
  const missingRecipeIds = [
    ...new Set(resolution.missing.map((reference) => reference.recipeId)),
  ]
  const globalConflicts = resolution.protectedOptions.filter(
    ({ option }) => !getLaunchOptionState(settings, preset.appid, option.id),
  )
  const run = async (action: () => Promise<void>) => {
    if (
      loading ||
      validationError ||
      (resolution.missing.length > 0 && catalog.isFetching) ||
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
        <DialogHeader>{preset.name}</DialogHeader>
        <DialogBody style={{ maxHeight: "55vh", overflowY: "auto" }}>
          <ModalScrollContent
            onFocusNext={() =>
              (reviewButtonRef.current ?? applyButtonRef.current)?.focus()
            }
          >
            <p>{preset.description}</p>
            <p>
              Selections apply only to this app. Unrelated options and global
              selections are preserved. Globally enabled controls take priority;
              presets never change their app overrides or definitions. Commands
              run when the app launches, not now.
            </p>
            {preset.launchOptions.map((reference) => {
              const option =
                resolution.selected.find(
                  (option) =>
                    option.source?.recipeId === reference.recipeId &&
                    option.source.launchOptionId === reference.launchOptionId,
                ) ??
                previews
                  .flatMap((recipe) => recipe.launchOptions ?? [])
                  .find(
                    (option) =>
                      option.source?.recipeId === reference.recipeId &&
                      option.source.launchOptionId === reference.launchOptionId,
                  )
              const protection = globalConflicts.find(
                (item) => item.reference === reference,
              )
              return (
                <section
                  key={JSON.stringify(reference)}
                  style={{ overflowWrap: "anywhere", marginBottom: 12 }}
                >
                  <strong>
                    {option?.name || reference.launchOptionId}
                    {option?.valueName ? `: ${option.valueName}` : ""}
                  </strong>
                  <div>
                    {reference.recipeId} / {reference.launchOptionId}
                  </div>
                  {option?.on && (
                    <>
                      <div>On command</div>
                      <pre style={{ whiteSpace: "pre-wrap" }}>{option.on}</pre>
                    </>
                  )}
                  {resolution.missing.includes(reference) && (
                    <div>
                      Not imported — will be skipped unless imported below.
                    </div>
                  )}
                  {protection && (
                    <div>
                      Protected by global preference:{" "}
                      {protection.globalOption.valueName ||
                        protection.globalOption.name ||
                        protection.globalOption.id}
                      . This control and its existing app overrides will not be
                      changed.
                    </div>
                  )}
                </section>
              )
            })}
          </ModalScrollContent>
          {resolution.missing.length > 0 && (
            <>
              <p>
                Some references are unavailable. Review their recipes below, or
                apply only available options. An incomplete preset will not be
                checked.
              </p>
              {catalog.isFetching && (
                <div role="status" aria-label="Loading referenced recipes">
                  <SteamSpinner />
                </div>
              )}
              {catalog.error && <div role="alert">{catalog.error.message}</div>}
              {missingRecipeIds.map((recipeId, index) => {
                const recipe = recipes.find((recipe) => recipe.id === recipeId)
                const reimport = settings.launchOptions.some(
                  (option) =>
                    option.source?.storeKey === storeKey(preset.store) &&
                    option.source.recipeId === recipeId,
                )
                return recipe ? (
                  <DialogButton
                    ref={index === 0 ? reviewButtonRef : undefined}
                    key={recipeId}
                    disabled={busy || loading || !!validationError}
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
                  >{`Review ${reimport ? "re-import" : "import"}: ${recipe.name}`}</DialogButton>
                ) : (
                  !catalog.isFetching && (
                    <p key={recipeId}>Recipe unavailable: {recipeId}</p>
                  )
                )
              })}
            </>
          )}
          {(validationError || error) && (
            <div role="alert">{validationError || error}</div>
          )}
          {result && (
            <div role="status">
              <p>
                {result.skipped.length
                  ? "Applied available options only."
                  : "Preset applied."}{" "}
                Selected: {result.selected}.
              </p>
              {result.skipped.length > 0 && (
                <>
                  <p>Skipped references:</p>
                  <ul>
                    {result.skipped.map((reference) => (
                      <li key={JSON.stringify(reference)}>
                        {reference.recipeId} / {reference.launchOptionId}
                        {reference.reason === "global-preference"
                          ? " — protected by global preference"
                          : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogButtonPrimary
            ref={applyButtonRef}
            disabled={
              loading ||
              busy ||
              !!validationError ||
              (resolution.missing.length > 0 && catalog.isFetching)
            }
            onClick={() =>
              void run(async () => {
                const outcome = await applyAppPreset(preset, previewOptions)
                if (!controller.current.signal.aborted) setResult(outcome)
              })
            }
          >
            {resolution.missing.length || globalConflicts.length
              ? "Apply available options"
              : "Apply preset"}
          </DialogButtonPrimary>
          <DialogButton
            onClick={() => {
              controller.current.abort()
              onClose()
            }}
          >
            Close
          </DialogButton>
        </DialogFooter>
      </Focusable>
    </ModalRoot>
  )
}
