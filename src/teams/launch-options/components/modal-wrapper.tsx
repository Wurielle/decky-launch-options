import { DialogBody, DialogHeader, ModalRoot } from "@decky/ui"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactNode } from "react"
import { PluginProvider } from "../../../components/plugin-provider"
import { queryClient } from "../../../query"

interface ModalWrapperProps {
  title: string
  children: ReactNode
  onClose: () => void
}

export function ModalWrapper({ title, children, onClose }: ModalWrapperProps) {
  return (
    <ModalRoot onCancel={onClose}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <QueryClientProvider client={queryClient}>
          <PluginProvider>{children}</PluginProvider>
        </QueryClientProvider>
      </DialogBody>
    </ModalRoot>
  )
}
