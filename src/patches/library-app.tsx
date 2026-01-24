import { afterPatch, createReactTreePatcher, findInReactTree } from '@decky/ui'
import { RoutePatch, routerHook } from '@decky/api'
import { ReactElement } from 'react'
import { ApplyLaunchOptions } from '../components/apply-launch-options'


export const libraryAppPatch = () => {
    const path = '/library/app/:appid'
    const patch = routerHook.addPatch('/library/app/:appid',
        (tree: { path: string; children: ReactElement }) => {
            const routeProps = findInReactTree(tree, (x: any) => x?.renderFunc)
            if (routeProps) {
                const patchHandler = createReactTreePatcher([
                    (tree: any) => findInReactTree(tree, (x: any) => x?.props?.children?.props?.overview)?.props?.children,
                ], (_: Array<Record<string, unknown>>, ret?: ReactElement) => {
                    // @ts-ignore
                    const dloComponent = ret?.props?.children?.find((child: ReactElement) => {
                        const props = (child?.props || {}) as Record<string, unknown>
                        return 'data-apply-launch-options' in props
                    })
                    if (!dloComponent) {
                        // @ts-ignore
                        ret?.props?.children?.push(
                            <ApplyLaunchOptions data-apply-launch-options/>,
                        )
                    }

                    return ret
                })


                afterPatch(routeProps, "renderFunc", patchHandler)
            }

            return tree
        })
    return [path, patch] as [string, RoutePatch]
}