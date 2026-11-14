import { fetchNoCors } from "@decky/api"
import {
  ButtonItem,
  DialogButton,
  Field,
  Focusable,
  PanelSectionRow,
  SteamSpinner,
  TextField,
} from "@decky/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { FaSyncAlt } from "react-icons/fa"
import { batchCreateLaunchOptions } from "../../components/batch-add-launch-options"
import {
  LaunchOptionControl,
  LaunchOptionControls,
  LaunchOptionFocusList,
} from "../../components/launch-option-focus"
import { getRecipesUrl, parseRecipes } from "./recipes"
import type { GithubStore } from "./store"

export function StoreRecipes({ store }: { store: GithubStore }) {
  const [search, setSearch] = useState("")
  const url = getRecipesUrl(store)
  const recipes = useQuery({
    queryKey: ["store-recipes", url],
    staleTime: 60_000,
    retry: false,
    enabled: store.type === "github",
    select: (data) =>
      [...data].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    queryFn: async () => {
      const source = new URL(url)
      source.searchParams.set("_", String(Date.now()))
      const response = await fetchNoCors(source.href)
      if (!response.ok)
        throw new Error(`Could not download recipes (HTTP ${response.status}).`)
      return parseRecipes(await response.json())
    },
  })
  const query = search.trim().toLocaleLowerCase()
  const filteredRecipes = recipes.data?.filter((recipe) =>
    recipe.name.toLocaleLowerCase().includes(query),
  )

  return (
    <LaunchOptionFocusList
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: "100%",
      }}
    >
      <Field childrenLayout="inline" childrenContainerWidth="max">
        <LaunchOptionControls style={{ width: "100%" }}>
          <LaunchOptionControl control="value" style={{ flex: 1, minWidth: 0 }}>
            <TextField
              aria-label="Search recipes"
              {...{ placeholder: "Search recipes…" }}
              style={{ width: "100%" }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </LaunchOptionControl>
          <LaunchOptionControl control="actions">
            <DialogButton
              aria-label="Refetch recipes"
              style={{
                minWidth: 40,
                width: 40,
                height: 40,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              disabled={recipes.isFetching}
              onClick={() => void recipes.refetch()}
            >
              <FaSyncAlt />
            </DialogButton>
          </LaunchOptionControl>
        </LaunchOptionControls>
      </Field>
      {recipes.isPending ? (
        <div
          role="status"
          aria-label="Loading recipes"
          style={{
            flex: 1,
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
      ) : recipes.error ? (
        <div role="alert" style={{ textAlign: "center" }}>
          {recipes.error.message}
        </div>
      ) : !filteredRecipes?.length ? (
        <div style={{ textAlign: "center" }}>
          {query ? "No matching recipes." : "No recipes found."}
        </div>
      ) : (
        <Focusable
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          {filteredRecipes.map((recipe, index) => (
            <div key={`${recipe.name}-${index}`} style={{ minWidth: 0 }}>
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={() => batchCreateLaunchOptions(recipe.launchOptions)}
                >
                  {recipe.name}
                </ButtonItem>
              </PanelSectionRow>
            </div>
          ))}
        </Focusable>
      )}
    </LaunchOptionFocusList>
  )
}
