interface Window {
  dloLaunchOptionsRestored?: Promise<
    Record<
      string,
      import("./utils/app-launch-options").RestoredAppLaunchOptions
    >
  >
}

declare module "*.svg" {
  const content: string
  export default content
}

declare module "*.png" {
  const content: string
  export default content
}

declare module "*.jpg" {
  const content: string
  export default content
}
