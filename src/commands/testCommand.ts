import commander from 'commander'
import {error} from '../utils/console'
import TestController from "../controllers/testController";

export default (program: typeof commander): commander.Command => program
    .command('test')
    .description('Run tests')
    .action((service: string | undefined) => {
        (new TestController()).executeStart(service).catch((err: any) => error(err.message))
    })