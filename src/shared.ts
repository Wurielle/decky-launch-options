export const routes = {
    launchOptions: () => '/launch-options',
    appLaunchOptions: (appid: number | string = ':appid') => `/launch-options/${ appid }`,
}

export type LaunchOption = {
    id: string
    name: string
    onCommand: string
    offCommand: string
    enableGlobally: boolean
}

export type Config = {
    profiles: Record<string, Record<string, boolean>>
    launchOptions: LaunchOption[]
}