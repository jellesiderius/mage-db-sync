import DatabaseTypeQuestion from "../questions/databaseTypeQuestion";
import checksTask from "../tasks/checksTask";
import downloadTask from "../tasks/downloadTask";
import { clearConsole } from "../utils/console";
import MainController from "./mainController";

class TestController extends MainController {    
    executeStart = async (): Promise<void> => {
        // Ask all the questions to the user
        await this.askQuestions();
        
        // Confure the task list
        await this.configureList();
        
        // Run the task list
        await this.list.run();
    }

    // Ask questions to user
    askQuestions = async () => {
        // Clear the console
        clearConsole();

        // Ask question about database type
        let databaseTypeQuestion = await new DatabaseTypeQuestion();
        await databaseTypeQuestion.configure(this.config);
        
        // Clear the console
        clearConsole();
    }

    // Configure task list
    configureList = async () => {
        // Build up check list
        let checkTask = await new checksTask();
        await checkTask.configure(this.list, this.config);
    }
}

export default TestController