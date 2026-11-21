import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import {
  persistQueryClient,
  persistQueryClientSave,
  type PersistedClient,
} from "@tanstack/react-query-persist-client"
import type { QueryClient } from "@tanstack/react-query"
import { parsePresetDefinition } from "../teams/app-presets/model"
import type { PresetDiscovery } from "../teams/app-presets/discovery"

export const presetPersistenceKey = "decky-launch-options/tanstack-presets/v1"
export const presetRestorationKey = ["preset-persistence-ready"]
type PresetStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

function browserStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function createPresetPersistence(
  client: QueryClient,
  storage: PresetStorage | undefined = browserStorage(),
) {
  // Defaults must exist before hydration, including queries not yet visited.
  client.setQueryDefaults(["app-presets"], {
    staleTime: 5 * 60_000,
    gcTime: Infinity,
  })
  const persister = createAsyncStoragePersister({
    storage,
    key: presetPersistenceKey,
    throttleTime: 0,
    serialize: (snapshot) =>
      JSON.stringify({
        ...snapshot,
        clientState: {
          ...snapshot.clientState,
          queries: snapshot.clientState.queries.map((query) => ({
            ...query,
            state: {
              ...query.state,
              // Keep the last usable data, without replaying refresh failures.
              status: "success",
              error: null,
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null,
              data: { ...(query.state.data as PresetDiscovery), errors: [] },
            },
          })),
        },
      }),
    deserialize: (serialized) => {
      const snapshot = JSON.parse(serialized) as PersistedClient
      snapshot.clientState.queries = snapshot.clientState.queries.flatMap(
        (query) => {
          try {
            if (query.queryKey[0] !== "app-presets") return []
            const data = query.state.data as PresetDiscovery
            return [
              {
                ...query,
                state: {
                  ...query.state,
                  data: {
                    presets: data.presets.map((preset) =>
                      parsePresetDefinition(preset, `${preset.id}.json`),
                    ),
                    errors: [],
                  },
                },
              },
            ]
          } catch {
            return []
          }
        },
      )
      return snapshot
    },
  })
  const options = {
    queryClient: client,
    persister,
    maxAge: Infinity,
    buster: "preset-definitions-v1",
    dehydrateOptions: {
      shouldDehydrateQuery: (query: {
        queryKey: readonly unknown[]
        state: { data: unknown }
      }) =>
        query.queryKey[0] === "app-presets" && query.state.data !== undefined,
      shouldDehydrateMutation: () => false,
    },
  }
  let restoring = false
  let restoration = Promise.resolve()
  let generation = 0
  let unsubscribe: (() => void) | undefined
  return {
    get ready() {
      return restoration
    },
    start: () => {
      unsubscribe?.()
      const current = ++generation
      restoring = true
      client.removeQueries({ queryKey: presetRestorationKey })
      const [stop, ready] = persistQueryClient(options)
      unsubscribe = stop
      restoration = ready
        .catch(() => {})
        .finally(() => {
          if (current !== generation) return
          restoring = false
        })
      return restoration
    },
    save: () =>
      restoring ? Promise.resolve() : persistQueryClientSave(options),
    stop: () => {
      generation++
      unsubscribe?.()
      unsubscribe = undefined
    },
  }
}
