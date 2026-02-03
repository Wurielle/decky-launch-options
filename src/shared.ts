import {v4 as uuid} from 'uuid'

export const routes = {
    launchOptions: () => '/launch-options',
    appLaunchOptions: (appid: number | string = ':appid') => `/launch-options/${ appid }`,
}

export const profileFactory = (profile: Partial<Profile> = {}): Profile => ({
    state: {},
    originalLaunchOptions: '',
    ...profile,
})

export const launchOptionFactory = (launchOption: Partial<LaunchOption> = {}): LaunchOption => ({
    id: uuid(),
    name: '',
    on: '',
    off: '',
    enableGlobally: false,
    ...launchOption,
})

export type Profile = {
    state: Record<string, boolean>
    originalLaunchOptions: string
}

export type LaunchOption = {
    id: string
    name: string
    on: string
    off: string
    enableGlobally: boolean
}

export type Settings = {
    profiles: Record<string, Profile>
    launchOptions: LaunchOption[]
}