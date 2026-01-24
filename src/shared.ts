export const routes = {
    launchOptions: () => '/launch-options',
    appLaunchOptions: (appid: number | string = ':appid') => `/launch-options/${ appid }`,
}

export const profileFactory = (profile: Partial<Profile> = {}) => ({
    state: {},
    originalLaunchOptions: '',
    ...profile,
})

export type Profile = {
    state: Record<string, boolean>
    originalLaunchOptions: string
}

export type LaunchOption = {
    id: string
    name: string
    onCommand: string
    offCommand: string
    enableGlobally: boolean
}

export type Settings = {
    profiles: Record<string, Profile>
    launchOptions: LaunchOption[]
}