import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fromJSON } from '../support/utils'
import { resolve } from 'path'

interface basicIOState {
    configPath: string,
}

interface Settings {
    width?: number
    height?: number
    pageX?: number
    pageY?: number
    isFullscreen?: boolean
}

const parseConfigFile = (configPath: string): Settings => {
    if (existsSync(configPath)) {
        const settingsConfigString: string = readFileSync(configPath, 'utf8')
        const settingsJsonObject: Settings = fromJSON(settingsConfigString).or({})
        return settingsJsonObject
    } else {
        return {}
    }
}

const basicIO = (state: basicIOState) => ({
    get: () => {
        return parseConfigFile(state.configPath)
    },
    set: (newObject: object) => {
        const oldSettingsJsonObject: object = parseConfigFile(state.configPath)
        const newSettingsJsonObject = {
            ...oldSettingsJsonObject,
            ...newObject
        }
        const newSettingsConfigString: string = JSON.stringify(newSettingsJsonObject, null, 4)
        writeFileSync(state.configPath, newSettingsConfigString)
    }
})

export default function settingsHandler() {
    const state = {
        configPath: resolve(`${process.env.XDG_CONFIG_HOME}/veonim/settings.json`)
    }
    return Object.assign(
        {},
        basicIO(state)
    )
}