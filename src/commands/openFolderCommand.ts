import commander from 'commander'
import openFolderController from '../controllers/openFolderController'
import {error} from '../utils/console'

export default (program: typeof commander): commander.Command => program
    .command('open-folder')
    .description('Opens the Mage-DB sync folder')
    .action((service: string | undefined) => {
        (new openFolderController()).executeStart(service).catch(err => error(err.message))
    })
