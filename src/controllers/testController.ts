import DatabaseTypeQuestion from "../questions/databaseTypeQuestion";
import checksTask from "../tasks/checksTask";
import downloadTask from "../tasks/downloadTask";
import { clearConsole } from "../utils/console";
import MainController from "./mainController";

class TestController extends MainController {    
    executeStart = async (): Promise<void> => {
        await this.askQuestions();
        await this.configureList();
        await this.list.run();
    }

    // Ask questions to user
    askQuestions = async () => {
        clearConsole();
        
        // Ask question about database type
        let databaseTypeQuestion = await new DatabaseTypeQuestion();
        await databaseTypeQuestion.configure(this.config);

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