/**
 * StartController - Enhanced with modern UI, performance features, and DI
 */
import MainController from './MainController';
import DatabaseTypeQuestion from '../questions/DatabaseTypeQuestion';
import SelectDatabaseQuestion from '../questions/SelectDatabaseQuestion';
import ConfigurationQuestions from '../questions/ConfigurationQuestions';
import DownloadTypesQuestion from '../questions/DownloadTypesQuestion';
import { UI } from '../utils/UI';
import { SSHConnectionPool } from '../utils/Performance';
import { TaskFactory } from '../core/TaskFactory';
import { ServiceContainer } from '../core/ServiceContainer';
import configFile from '../../config/settings.json';

class StartController extends MainController {
    private taskFactory: TaskFactory;
    private services: ServiceContainer;

    constructor() {
        super();
        this.taskFactory = TaskFactory.getInstance();
        this.services = ServiceContainer.getInstance();
    }
    public async execute(): Promise<void> {
        return this.executeStart();
    }

    executeStart = async (): Promise<void> => {
        try {
            UI.showBanner();

            await this.askQuestions();
            await this.prepareTasks();

            this.showTaskSummary();

            await this.list.run();

            await this.showCompletionMessage();

            await SSHConnectionPool.closeAll();

            process.exit(0);
        } catch (e) {
            const error = e as Error;
            UI.error(`Operation failed: ${error.message}`);

            if (error.stack) {
                console.log('\n' + error.stack);
            }

            await SSHConnectionPool.closeAll();
            process.exit(1);
        }
    };

    private showTaskSummary(): void {
        console.log('');
        UI.section('Task Summary');

        const tasks = [];

        if (this.config.settings.syncTypes && Array.isArray(this.config.settings.syncTypes) && this.config.settings.syncTypes.includes('Magento database')) {
            tasks.push({
                label: 'Download Database',
                value: `${this.config.databases.databaseType} (${this.config.settings.strip === 'custom' ? 'custom strip' : this.config.settings.strip || 'full'})`
            });
        }

        if (this.config.settings.import === 'yes') {
            tasks.push({
                label: 'Import to Magento',
                value: this.config.settings.currentFolder
            });
        }

        if (this.config.settings.wordpressDownload === 'yes') {
            tasks.push({
                label: 'Download WordPress',
                value: 'Yes'
            });
        }

        if (this.config.settings.wordpressImport === 'yes') {
            tasks.push({
                label: 'Import WordPress',
                value: 'Yes'
            });
        }


        UI.table(tasks);

        console.log('');
        UI.box(
            'This may take a few minutes...\n' +
            'Grab some coffee while you wait!',
            { type: 'info', title: 'Starting Operations' }
        );
    }

    private async showCompletionMessage(): Promise<void> {
        console.log('\n');

        if (this.config.finalMessages.importDomain.length > 0) {
            const urls = this.config.finalMessages.domains;
            const message =
                `Magento successfully imported!\n\n` +
                `Your project is available at:\n` +
                urls.map((url: string) => `   ${url}`).join('\n') +
                `\n\n` +
                `Backend Credentials:\n` +
                `   Username: ${configFile.magentoBackend.adminUsername}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}\n\n` +
                `Customer Account (all websites):\n` +
                `   Email: ${configFile.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: 'Magento Import Complete' });
        } else if (this.config.finalMessages.magentoDatabaseLocation.length > 0) {
            let message = `Downloaded Magento database to:\n${this.config.finalMessages.magentoDatabaseLocation}`;

            if (
                this.config.finalMessages.wordpressDatabaseLocation.length > 0 &&
                this.config.settings.wordpressDownload === 'yes' &&
                this.config.settings.wordpressImport !== 'yes'
            ) {
                message += `\n\nDownloaded WordPress database to:\n${this.config.finalMessages.wordpressDatabaseLocation}`;
            }

            UI.box(message, { type: 'success', title: 'Download Complete' });
        }

        if (this.config.settings.wordpressImport === 'yes') {
            let message =
                `WordPress successfully imported!\n\n`;
            
            // Add blog URLs if available
            if (this.config.finalMessages.wordpressBlogUrls && this.config.finalMessages.wordpressBlogUrls.length > 0) {
                message += `Your WordPress sites are available at:\n`;
                message += this.config.finalMessages.wordpressBlogUrls
                    .map((blog: {blogId: string, domain: string}) => `   Blog ID ${blog.blogId}: ${blog.domain}`)
                    .join('\n');
                message += `\n\n`;
            }
            
            message +=
                `Backend Credentials:\n` +
                `   Username: ${configFile.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: 'WordPress Import Complete' });
        }

        // Log completion
        const logger = this.services.getLogger();
        logger.info('Operation completed successfully', {
            component: 'StartController'
        });
    }

    askQuestions = async () => {
        UI.section('Configuration');

        const databaseTypeQuestion = await new DatabaseTypeQuestion();
        await databaseTypeQuestion.configure(this.config);

        const selectDatabaseQuestion = await new SelectDatabaseQuestion();
        await selectDatabaseQuestion.configure(this.config);


        const downloadTypesQuestion = await new DownloadTypesQuestion();
        await downloadTypesQuestion.configure(this.config);

        const configurationQuestions = await new ConfigurationQuestions();
        await configurationQuestions.configure(this.config);
    };

    prepareTasks = async () => {
        console.log('');
        UI.info('Preparing tasks...\n');

        const logger = this.services.getLogger();
        logger.info('Preparing task pipeline', { component: 'StartController' });

        // Create tasks via factory (DI pattern)
        const checksTask = this.taskFactory.createChecksTask();
        await checksTask.configure(this.list, this.config, this.ssh);

        const downloadTask = this.taskFactory.createDownloadTask();
        await downloadTask.configure(this.list, this.config, this.ssh, this.sshSecondDatabase);

        if (this.config.settings.import === 'yes') {
            const importTask = this.taskFactory.createImportTask();
            await importTask.configure(this.list, this.config);
        }


        if (this.config.settings.import === 'yes') {
            const magentoConfigureTask = this.taskFactory.createMagentoConfigureTask();
            await magentoConfigureTask.configure(this.list, this.config);
        }

        if (this.config.settings.wordpressImport === 'yes') {
            const wordpressConfigureTask = this.taskFactory.createWordpressConfigureTask();
            await wordpressConfigureTask.configure(this.list, this.config);
        }

        logger.info('Task pipeline prepared successfully', {
            taskCount: this.list.tasks.length
        });
    };
}

export default StartController;
export { StartController };
