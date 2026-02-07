import {LaunchOption, launchOptionFactory} from "../shared";
import {useImmer} from "use-immer";
import {useSettings} from "../hooks";
import {useCallback} from "react";
import {
    DialogBody,
    DialogButton,
    DialogButtonPrimary,
    DialogControlsSection,
    DialogControlsSectionHeader,
    DialogFooter,
    DialogHeader,
    Field,
    Focusable,
    ModalRoot,
    showModal,
    TextField,
    ToggleField
} from "@decky/ui";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "../query";


export function BatchAddLaunchOptions({data, onSubmit, onCancel}: {
    data: Partial<LaunchOption>[],
    onSubmit: () => void,
    onCancel: () => void
}) {
    const [launchOptions, setLaunchOptions] = useImmer(data.map(launchOptionFactory))
    const {batchCreateLaunchOptions} = useSettings()
    const showLaunchOptions = useCallback(() => {
        const modalResult = showModal(
            <ModalRoot onCancel={() => {
                onCancel()
                modalResult.Close()
            }}>
                <DialogBody>
                    {launchOptions.map((launchOption, index) => (
                        <DialogControlsSection>
                            <DialogControlsSectionHeader>{launchOption.name}</DialogControlsSectionHeader>
                            <Field description={
                                <div style={{padding: '0 0 0 22'}}>
                                    <TextField
                                        label={'On'}
                                        disabled={true}
                                        value={launchOption.on}
                                    />
                                    <TextField
                                        label={'Off'}
                                        disabled={true}
                                        value={launchOption.off}
                                    />
                                    <ToggleField
                                        label={'Enable globally'}
                                        bottomSeparator={'none'}
                                        checked={launchOption.enableGlobally}
                                        onChange={(value) => {
                                            setLaunchOptions((draft) => {
                                                draft[index].enableGlobally = value
                                            })
                                        }}
                                    />
                                </div>
                            }/>
                        </DialogControlsSection>
                    ))}
                </DialogBody>
                <DialogFooter>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                        <DialogButtonPrimary onClick={() => {
                            batchCreateLaunchOptions(launchOptions)
                            onSubmit()
                            modalResult.Close()
                        }}>Add to Decky Launch Options</DialogButtonPrimary>
                        <DialogButton onClick={() => {
                            onCancel()
                            modalResult.Close()
                        }}>Cancel</DialogButton>
                    </div>
                </DialogFooter>
            </ModalRoot>
        )
    }, [onCancel, launchOptions, onSubmit, batchCreateLaunchOptions])
    return (
        <ModalRoot onCancel={onCancel}>
            <DialogHeader>Decky Launch Options</DialogHeader>
            <DialogBody>
                <p>An application would like to add the following launch options:</p>
                <Focusable style={{maxHeight: "145px", overflowY: "auto"}}>
                    <ul>
                        {launchOptions.map((launchOption, index) => (
                            <li key={index}>
                                {launchOption.name}
                            </li>
                        ))}
                    </ul>
                </Focusable>
                <p>Please review each of them carefully before accepting.</p>
            </DialogBody>
            <DialogFooter>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                    <DialogButtonPrimary onClick={() => {
                        showLaunchOptions()
                    }}>I understand</DialogButtonPrimary>
                </div>
            </DialogFooter>
        </ModalRoot>
    )
}

export function batchCreateLaunchOptions(launchOptions: Partial<LaunchOption>[]) {
    const modalResult = showModal(
        <QueryClientProvider client={queryClient}>
            <BatchAddLaunchOptions
                data={launchOptions}
                onSubmit={() => modalResult.Close()}
                onCancel={() => modalResult.Close()}
            />
        </QueryClientProvider>
    )

}