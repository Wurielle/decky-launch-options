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
                                             onCancel={ () => setEnableGloballyKey((k) => k+1) }
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
                    <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' } }>
                        <span>Advanced</span> { showAdvanced ? <FaChevronUp/> : <FaChevronDown/> }
                    </div>
                </DialogButton>
            </div>
            { showAdvanced && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'Group' }
                            { ...({ placeholder: 'E.g.: Favorites' }) }
                            description={ <div style={ { textAlign: 'left' } }>Groups this launch option under a named
                                tab</div> }
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
                            description={ <div style={ { textAlign: 'left' } }>Launch options sharing the same Value
                                ID are displayed as a
                                dropdown</div> }
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
                            description={ <div style={ { textAlign: 'left' } }>Display name shown in the
                                dropdown</div> }
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
                        label={ 'Set as fallback value' }
                        checked={ data.fallbackValue }
                        disabled={ !data.valueId }
                        description={ 'Selected by default in the dropdown when no other value is chosen' }
                        onChange={ (value) => onChange('fallbackValue', value) }
                    />
                </div>
            ) }
            { showAdvanced && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'Priority' }
                            { ...({ placeholder: '0' }) }
                            description={ <div style={ { textAlign: 'left' } }>Higher priority launch options run
                                first</div> }
                            style={ { width: '100%' } }
                            value={ data.priority ? String(data.priority) : '' }
                            onChange={ (e) => {
                                scrollIntoView(e)
                                const num = Number(e.target.value)
                                onChange('priority', Number.isFinite(num) ? num : 0)
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
        </>
    )
}
