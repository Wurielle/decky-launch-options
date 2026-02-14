import {produce} from "immer";
import {Store, StoreOptions} from '@tanstack/react-store'

function createStore<S>(state: S, options: StoreOptions<S, (state: S) => void> = {}) {
    return new Store<S, (state: S) => void>(state, {
        updateFn: (state) => (updater) => produce(state, updater),
        ...options
    });
}

export const settingsLocalStorageKey = 'decky-launch-options-settings'
const settingsLocalStorageValue = localStorage.getItem(settingsLocalStorageKey)
const defaultSettingsStoreState = {
    useHierarchy: true
}
export const settingsStore = createStore<typeof defaultSettingsStoreState>({
    ...defaultSettingsStoreState,
    ...(settingsLocalStorageValue ? JSON.parse(settingsLocalStorageValue) : {})
}, {
    onUpdate() {
        localStorage.setItem(settingsLocalStorageKey, JSON.stringify(settingsStore.state))
    }
});

settingsStore.subscribe(({currentVal}) => {
    localStorage.setItem(settingsLocalStorageKey, JSON.stringify(currentVal))
})