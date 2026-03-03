import { TextField, ToggleField } from "@decky/ui"
import { LaunchOption } from "../shared"
import { ScrollIntoView } from "./scroll-into-view"

interface LaunchOptionFieldsProps {
    data: LaunchOption;
    onChange: <K extends keyof LaunchOption>(field: K, value: LaunchOption[K]) => void;
    /** When true, only show fields common to a valueId group (enableGlobally, name, group, valueId) */
    commonOnly?: boolean;
}

export function LaunchOptionFields({ data, onChange, commonOnly }: LaunchOptionFieldsProps) {
    const hasValueId = !!data.valueId
    const hidePerValue = commonOnly && hasValueId

    return (
        <>
            <div style={ { marginBottom: 22 } }>
                <ToggleField label={ 'Enable globally' } checked={ data.enableGlobally }
                             onChange={ (value) => onChange('enableGlobally', value) }/>
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
            <ScrollIntoView>
                { ({ scrollIntoView }) => (
                    <TextField
                        label={ 'Group (optional)' }
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
            <ScrollIntoView>
                { ({ scrollIntoView }) => (
                    <TextField
                        label={ 'Value ID (optional)' }
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
            { !hidePerValue && (
                <ScrollIntoView>
                    { ({ scrollIntoView }) => (
                        <TextField
                            label={ 'Value Name (optional)' }
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
        </>
    )
}
