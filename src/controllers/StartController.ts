/**
 * StartController - Enhanced with modern UI and performance features
 */
import MainController from './MainController';
import DatabaseTypeQuestion from '../questions/DatabaseTypeQuestion';
import SelectDatabaseQuestion from '../questions/SelectDatabaseQuestion';
import ConfigurationQuestions from '../questions/ConfigurationQuestions';
import ChecksTask from '../tasks/ChecksTask';
import DownloadTask from '../tasks/DownloadTask';
import ImportTask from '../tasks/ImportTask';
import MagentoConfigureTask from '../tasks/MagentoConfigureTask';
import WordpressConfigureTask from '../tasks/WordpressConfigureTask';
import SyncDatabasesQuestions from '../questions/SyncDatabasesQuestions';
import SyncImportTask from '../tasks/SyncImportTask';
import DownloadTypesQuestion from '../questions/DownloadTypesQuestion';
import { UI } from '../utils/UI';
import { PerformanceMonitor, SSHConnectionPool } from '../utils/Performance';
// @ts-ignore
import configFile from '../../config/settings.json';

class StartController extends MainController {
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
            UI.error(`Operation failed: ${e.message}`);
            
            if (e.stack) {
                console.log('\n' + e.stack);
            }
            
            await SSHConnectionPool.closeAll();
            process.exit(1);
        }
    };

    private showTaskSummary(): void {
        console.log('');
        UI.section('📋 Task Summary');

        const tasks = [];

        if (this.config.settings.syncTypes && this.config.settings.syncTypes.includes('Magento database')) {
            tasks.push({
                label: 'Download Database',
                value: `${this.config.databases.databaseType} (${this.config.settings.strip || 'full'})`
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

        if (this.config.settings.syncDatabases === 'yes') {
            tasks.push({
                label: 'Sync Databases',
                value: `${this.config.databases.databaseData.username} ⟷ ${this.config.databases.databaseDataSecond.username}`
            });
        }

        UI.table(tasks);

        console.log('');
        UI.box(
            '⏳ This may take a few minutes...\n\n' +
            '💡 Grab some ☕ coffee while you wait!\n\n' +
            '⚡ V2 Performance features active:\n' +
            '  • Parallel validation checks\n' +
            '  • SSH connection pooling\n' +
            '  • Real-time progress tracking\n' +
            '  • Performance monitoring',
            { type: 'info', title: 'Starting Operations' }
        );
    }

    private async showCompletionMessage(): Promise<void> {
        console.log('\n');

        if (this.config.finalMessages.importDomain.length > 0) {
            const urls = this.config.finalMessages.domains;
            const message =
                `✅ Magento successfully imported!\n\n` +
                `🌐 Your project is available at:\n` +
                urls.map((url: string) => `   ${url}`).join('\n') +
                `\n\n` +
                `🔐 Backend Credentials:\n` +
                `   Username: ${configFile.magentoBackend.adminUsername}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}\n\n` +
                `👤 Customer Account (all websites):\n` +
                `   Email: ${configFile.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: '🎉 Import Complete' });
        } else if (this.config.finalMessages.magentoDatabaseLocation.length > 0) {
            let message = `✅ Downloaded Magento database to:\n   ${this.config.finalMessages.magentoDatabaseLocation}`;

            if (
                this.config.finalMessages.wordpressDatabaseLocation.length > 0 &&
                this.config.settings.wordpressDownload === 'yes' &&
                this.config.settings.wordpressImport !== 'yes'
            ) {
                message += `\n\n✅ Downloaded WordPress database to:\n   ${this.config.finalMessages.wordpressDatabaseLocation}`;
            }

            UI.box(message, { type: 'success', title: '📦 Download Complete' });
        }

        if (this.config.settings.wordpressImport === 'yes') {
            const message =
                `✅ WordPress successfully imported!\n\n` +
                `🔐 Backend Credentials:\n` +
                `   Username: ${configFile.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: '📝 WordPress Import Complete' });
        }

        PerformanceMonitor.showSummary();
    }

    askQuestions = async () => {
        UI.section('⚙️  Configuration');

        let databaseTypeQuestion = await new DatabaseTypeQuestion();
        await databaseTypeQuestion.configure(this.config);

        let selectDatabaseQuestion = await new SelectDatabaseQuestion();
        await selectDatabaseQuestion.configure(this.config);

        // @ts-ignore
        if (
            this.config.databases.databaseData.stagingUsername &&
            this.config.databases.databaseDataSecond.username &&
            this.config.settings.rsyncInstalled
        ) {
            let syncDatabaseQuestion = await new SyncDatabasesQuestions();
            await syncDatabaseQuestion.configure(this.config);
        }

        let downloadTypesQuestion = await new DownloadTypesQuestion();
        await downloadTypesQuestion.configure(this.config);

        let configurationQuestions = await new ConfigurationQuestions();
        await configurationQuestions.configure(this.config);
    };

    prepareTasks = async () => {
        console.log('');
        UI.info('Preparing tasks...\n');

        let checksTask = await new ChecksTask();
        await checksTask.configure(this.list, this.config, this.ssh);

        let downloadTask = await new DownloadTask();
        await downloadTask.configure(this.list, this.config, this.ssh, this.sshSecondDatabase);

        if (this.config.settings.import === 'yes') {
            let importTask = await new ImportTask();
            await importTask.configure(this.list, this.config);
        }

        if (this.config.settings.syncDatabases === 'yes') {
            let syncImportTask = await new SyncImportTask();
            await syncImportTask.configure(this.list, this.config, this.sshSecondDatabase);
        }

        if (this.config.settings.import === 'yes') {
            let magentoConfigureTask = await new MagentoConfigureTask();
            await magentoConfigureTask.configure(this.list, this.config);
        }

        if (this.config.settings.wordpressImport === 'yes') {
            let wordpressConfigureTask = await new WordpressConfigureTask();
            await wordpressConfigureTask.configure(this.list, this.config);
        }
    };
}

export default StartController;
export { StartController };
