// this isn't 100% robust, but it's better than the behavior without this
import {HTMLAttributes, ReactNode, RefObject, useCallback, useRef} from "react";
import {Focusable} from "@decky/ui";

export function ScrollIntoView(props: Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    children: (context: {
        ref: RefObject<HTMLDivElement | null>
        scrollIntoView: (event?: any) => void
    }) => ReactNode
}) {
    const {children, ...rootProps} = props
    const ref = useRef<HTMLDivElement>(null)
    const scrollIntoView = useCallback((event?: any) => {
        const block = (window.SteamUIStore.GetFocusedWindowInstance() as any).VirtualKeyboardManager.KeyboardLocation.includes('top') ? 'start' : 'end'
        const element = (event?.target || ref.current) as HTMLElement
        element?.scrollIntoView?.({behavior: 'instant', block})
    }, [])
    return <Focusable ref={ref} {...rootProps}>
        {props.children({ref, scrollIntoView})}
    </Focusable>
}