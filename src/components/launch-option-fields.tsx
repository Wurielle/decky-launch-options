import { ConfirmModal, DialogButton, showModal, TextField, ToggleField } from "@decky/ui"
import { LaunchOption } from "../shared"
import { ScrollIntoView } from "./scroll-into-view"
import { useState } from "react"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"

interface LaunchOptionFieldsProps {
    data: LaunchOption;
    onChange: <K extends keyof LaunchOption>(field: K, value: LaunchOption[K]) => void;
    /** When true, only show fields common to a valueId group (enableGlobally, name, group, valueId) */
    commonOnly?: boolean;
}

export function LaunchOptionFields({ data, onChange, commonOnly }: LaunchOptionFieldsProps) {
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [enableGloballyKey, setEnableGloballyKey] = useState(0)
    const hasValueId = !!data.valueId
    const hidePerValue = commonOnly && hasValueId

    return (
        <>
            <div style={ { marginBottom: 22 } }>
                <ToggleField key={ enableGloballyKey } label={ 'Enable globally' } checked={ data.enableGlobally }
                             onChange={ (value) => {
                                 if (value) {
                                     showModal(
                                         <ConfirmModal
                                             strTitle="Enable globally"
                                             strDescription="This will clear all per-app selections for this launch option. Do you want to continue?"
                                             strOKButtonText="Confirm"
                                             strCancelButtonText="Cancel"
                                             onOK={ () => onChange('enableGlobally', true) }
                                             onCancel={ () => setEnableGloballyKey((k) => k + 1) }
                                         />,
                                     )
                                 } else {
                                     onChange('enableGlobally', false)
                                 }
                             } }/>
            </div>
            <ScrollIntoView>
                { ({ scrollIntoView }) => (
                    <TextField
                        label={ 'Name' }
                        { ...({ placeholder: 'E.g.: Steam Deck Mode' }) }
                        style={ { width: '100%' } }
                        value={ data.name }
                        onChange={ (e) => {
                            scrollIntoView(e)
                            onChange('name', e.target.value)
                        } }
                        onKeyDown={ scrollIntoView }
                        onKeyUp={ scrollIntoView }
                        onInput={ scrollIntoView }
                        onSelect={ scrollIntoView }
                        onFocus={ scrollIntoView }
                    />
                ) }
            </ScrollIntoView>
            { !hidePerValue && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'On command' }
                            { ...({ placeholder: 'E.g.: SteamDeck=1 ~/script/install %command% -novid' }) }
                            style={ { width: '100%' } }
                            value={ data.on }
                            onChange={ (e) => {
                                scrollIntoView(e)
                                onChange('on', e.target.value)
                            } }
                            onKeyDown={ scrollIntoView }
                            onKeyUp={ scrollIntoView }
                            onInput={ scrollIntoView }
                            onSelect={ scrollIntoView }
                            onFocus={ scrollIntoView }
                        />
                    ) }
                </ScrollIntoView>
            ) }
            { !hidePerValue && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'Off command' }
                            { ...({ placeholder: 'E.g.: SteamDeck=0 ~/script/uninstall %command% -novid' }) }
                            style={ { width: '100%' } }
                            value={ data.off }
                            onChange={ (e) => {
                                scrollIntoView(e)
                                onChange('off', e.target.value)
                            } }
                            onKeyDown={ scrollIntoView }
                            onKeyUp={ scrollIntoView }
                            onInput={ scrollIntoView }
                            onSelect={ scrollIntoView }
                            onFocus={ scrollIntoView }
                        />
                    ) }
                </ScrollIntoView>
            ) }
            <div style={ {
                marginBottom: 22,
            } }>
                <DialogButton
                    onClick={ () => {
                        setShowAdvanced((value) => !value)
                    } }
                >
                    Advanced { showAdvanced ? <FaChevronUp/> : <FaChevronDown/> }
                </DialogButton>
            </div>
            { showAdvanced && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'Group' }
                            { ...({ placeholder: 'E.g.: Favorites' }) }
                            style={ { width: '100%' } }
                            value={ data.group }
                            onChange={ (e) => {
                                scrollIntoView(e)
                                onChange('group', e.target.value)
                            } }
                            onKeyDown={ scrollIntoView }
                            onKeyUp={ scrollIntoView }
                            onInput={ scrollIntoView }
                            onSelect={ scrollIntoView }
                            onFocus={ scrollIntoView }
                        />
                    ) }
                </ScrollIntoView>
            ) }
            { showAdvanced && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'Value ID' }
                            { ...({ placeholder: 'E.g.: proton-version' }) }
                            style={ { width: '100%' } }
                            value={ data.valueId }
                            onChange={ (e) => {
                                scrollIntoView(e)
                                onChange('valueId', e.target.value)
                            } }
                            onKeyDown={ scrollIntoView }
                            onKeyUp={ scrollIntoView }
                            onInput={ scrollIntoView }
                            onSelect={ scrollIntoView }
                            onFocus={ scrollIntoView }
                        />
                    ) }
                </ScrollIntoView>
            ) }
            { showAdvanced && !hidePerValue && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'Value Name' }
                            { ...({ placeholder: 'E.g.: Version 7' }) }
                            style={ { width: '100%' } }
                            value={ data.valueName }
                            onChange={ (e) => {
                                scrollIntoView(e)
                                onChange('valueName', e.target.value)
                            } }
                            onKeyDown={ scrollIntoView }
                            onKeyUp={ scrollIntoView }
                            onInput={ scrollIntoView }
                            onSelect={ scrollIntoView }
                            onFocus={ scrollIntoView }
                        />
                    ) }
                </ScrollIntoView>
            ) }
            { showAdvanced && !hidePerValue && (
                <div style={ { marginBottom: 22 } }>
                    <ToggleField
                        label={ 'Unset default (None)' }
                        checked={ data.unsetDefault }
                        disabled={ !data.valueId }
                        description={ !data.valueId ? 'Set Value ID to enable an explicit None option.' : undefined }
                        onChange={ (value) => onChange('unsetDefault', value) }
                    />
                </div>
            ) }
        </>
    )
}
