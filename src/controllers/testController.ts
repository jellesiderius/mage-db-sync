import { clearConsole } from "../utils/console";
import MainController from "./mainController";
import DatabaseTypeQuestion from "../questions/databaseTypeQuestion";
import SelectDatabaseQuestion from "../questions/selectDatabaseQuestion";
import ConfigurationQuestions from "../questions/configurationQuestions";
import ChecksTask from "../tasks/checksTask";
import DownloadTask from "../tasks/downloadTask";

class TestController extends MainController {    
    executeStart = async (): Promise<void> => {
        // Ask all the questions to the user
        await this.askQuestions();
        
        // Configure task list
        await this.prepareTasks();

        // Run all tasks
        try {
            await this.list.run();
            process.exit();
        } catch (e) {
            console.error(e)
        }
    }

    // Ask questions to user
    askQuestions = async () => {
        // Clear the console
        clearConsole();

        // Ask question about database type
        let databaseTypeQuestion = await new DatabaseTypeQuestion();
        await databaseTypeQuestion.configure(this.config);

        // Make user choose a database from the list
        let selectDatabaseQuestion = await new SelectDatabaseQuestion();
        await selectDatabaseQuestion.configure(this.config);

        // Adds multiple configuration questions
        let configurationQuestions = await new ConfigurationQuestions();
        await configurationQuestions.configure(this.config);

        // Clear the console
        clearConsole();
    }

    // Configure task list
    prepareTasks = async () => {
        // Build up check list
        let checkTask = await new ChecksTask();
        await checkTask.configure(this.list, this.config);

        // Build up download list
        let downloadTask = await new DownloadTask();
        await downloadTask.configure(this.list, this.config, this.ssh);

        // TODO: Make import tasks

         // TODO: Make Magento configure tasks

         // TODO: Make Wordpress configure tasks
    }
}

export default TestController