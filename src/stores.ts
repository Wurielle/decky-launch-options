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
const savedSettingsStoreState = settingsLocalStorageValue ? JSON.parse(settingsLocalStorageValue) : {}

export type LaunchOptionSort = 'local-alphabetical' | 'local-active' | 'global-alphabetical' | 'global-active'

interface SettingsStoreState {
    autoManageLaunchOptions: boolean;
    useHierarchy: boolean;
    showCommands: boolean;
    launchOptionSort: LaunchOptionSort;
}

export const launchOptionSortOptions: Array<{ data: LaunchOptionSort; label: string }> = [
    { data: 'local-alphabetical', label: 'Local - Alphabetical' },
    { data: 'local-active', label: 'Local - Active' },
    { data: 'global-alphabetical', label: 'Global - Alphabetical' },
    { data: 'global-active', label: 'Global - Active' },
]

const defaultSettingsStoreState: SettingsStoreState = {
    autoManageLaunchOptions: true,
    useHierarchy: true,
    showCommands: false,
    launchOptionSort: 'global-active',
}
export const settingsStore = createStore<SettingsStoreState>({
    ...defaultSettingsStoreState,
    ...savedSettingsStoreState,
    autoManageLaunchOptions: savedSettingsStoreState.autoManageLaunchOptions ?? savedSettingsStoreState.autoUpdateLaunchOptions ?? defaultSettingsStoreState.autoManageLaunchOptions,
}, {
    onUpdate() {
        localStorage.setItem(settingsLocalStorageKey, JSON.stringify(settingsStore.state))
    }
});

settingsStore.subscribe(({currentVal}) => {
    localStorage.setItem(settingsLocalStorageKey, JSON.stringify(currentVal))
})
