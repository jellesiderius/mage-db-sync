import commander from 'commander'
import fs from 'fs'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function (program: typeof commander): commander.Command[] {
    const commands: commander.Command[] = []
    const loadPath = path.dirname(__filename)

    // Loop through command files
    fs.readdirSync(loadPath).filter(function (filename) {
        return (/\.js$/.test(filename) && filename !== 'index.js')
    }).forEach(function (filename) {
        // const name: string = filename.substr(0, filename.lastIndexOf('.'))

        // Require command
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const command = require(path.join(loadPath, filename))

        // Initialize command
        commands.push(command.default(program))
    })

    return commands
}