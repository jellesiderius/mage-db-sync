import commander from 'commander'
import {error} from '../utils/console'
import SelfUpdateController from "../controllers/selfUpdateController";

export default (program: typeof commander): commander.Command => program
    .command('self-update')
    .description('Updates the database synchronizer to the latest version')
    .action((service: string | undefined) => {
        (new SelfUpdateController()).executeStart(service).catch((err: any) => error(err.message))
    })