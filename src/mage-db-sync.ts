import program from 'commander'
import commandLoader from './commands/index'

commandLoader(program)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json')

program
    .version(packageJson.version)
    .usage('<command> [options]')
    .description(`Magento Database Synchronizer, based on Magerun - ${packageJson.version}`)

program.on('command:*', () => {
    program.help()
})

program.parse(process.argv)

if (!process.argv.slice(2).length) {
    program.outputHelp()
    process.exit()
}