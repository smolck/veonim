import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

interface basicIOState {
    configPath: string,
}

function parseConfigFile(configPath: string): object {
    if (existsSync(configPath)) {
        const settingsConfigString: string = readFileSync(configPath, 'utf8');
        const settingsJsonObject: object = JSON.parse(settingsConfigString)
        return settingsJsonObject || null
    } else {
        return {};
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