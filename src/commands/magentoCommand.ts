import commander from 'commander'
import MagentoController from '../controllers/magentoController'
import {error} from '../utils/console'

export default (program: typeof commander): commander.Command => program
    .command('start')
    .description('Starts the database synchronizer')
    .action((service: string | undefined) => {
        (new MagentoController()).executeStart(service).catch(err => error(err.message))
    })