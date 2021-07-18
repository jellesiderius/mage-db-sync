import commander from 'commander'
import ImportController from '../controllers/startController'
import {error} from '../utils/console'

export default (program: typeof commander): commander.Command => program
    .command('start')
    .description('Starts the database synchronizer')
    .action((service: string | undefined) => {
        (new ImportController()).executeStart(service).catch(err => error(err.message))
    }) 