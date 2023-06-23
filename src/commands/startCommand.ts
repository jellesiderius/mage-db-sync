import commander from 'commander'
import StartController from '../controllers/startController'
import {error} from '../utils/console'

export default (program: typeof commander): commander.Command => program
    .command('start')
    .description('Starts the database synchronizer')
    .action((service: string | undefined) => {
        (new StartController()).executeStart(service).catch(err => error(err.message))
    })
