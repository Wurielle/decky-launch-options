import { usePlugin } from "./plugin-provider"
import { ConfirmModal, DialogButton, showModal } from "@decky/ui"
import { useMemo } from "react"
import { LaunchOptionFields } from "./launch-option-fields"

export function UpdateLaunchOptionForm({
                                           id,
                                           onDelete,
                                           commonOnly = true,
                                           syncCommonFields = true,
                                           deleteByValueId = false,
                                       }: {
    id: string,
    onDelete?: () => void
    commonOnly?: boolean
    syncCommonFields?: boolean
    deleteByValueId?: boolean
}) {
    const { updateLaunchOption, deleteLaunchOption, deleteLaunchOptionsByValueId, settings } = usePlugin().settings

    const data = useMemo(() => settings.launchOptions.find((launchOption) => launchOption.id === id), [settings.launchOptions, id])

    if (!data) return null

    function remove() {
        if (!data) return null
        return showModal(
            <ConfirmModal
                strTitle={ deleteByValueId && data.valueId ? 'Remove launch options' : 'Remove launch option' }
                strDescription={
                    deleteByValueId && data.valueId
                        ? `Do you want to remove all launch options with value ID "${ data.valueId }"?`
                        : `Do you want to remove the "${ data.name || 'Unnamed' }" launch option?`
                }
                strOKButtonText="Confirm"
                strCancelButtonText="Cancel"
                onOK={ async () => {
                    if (deleteByValueId && data.valueId) {
                        deleteLaunchOptionsByValueId(data.valueId)
                    } else {
                        deleteLaunchOption(data.id)
                    }
                    onDelete?.()
                } }
            />,
        )
    }

    return (
        <div>
            <LaunchOptionFields
                data={ data }
                onChange={ (field, value) => updateLaunchOption(data, field, value, syncCommonFields) }
                commonOnly={ commonOnly }
            />
            <div style={ { display: 'flex', gap: '10px' } }>
                <DialogButton style={ { flex: 1 } }
                              onClick={ remove }>
                    <div style={ {
                        color: 'oklch(63.7% 0.237 25.331)',
                        fontWeight: 'bold',
                    } }>
                        Remove launch option
                    </div>
                </DialogButton>
            </div>
        </div>
    )
}
