import { localhostMagentoRootExec } from '../utils/Console';

/**
 * Service to validate store and website IDs exist in Magento database
 */
export class MagentoStoreValidator {
    /**
     * Fetch all valid store IDs from Magento
     */
    async getValidStoreIds(config: any): Promise<string[]> {
        try {
            const query = `SELECT store_id FROM store WHERE store_id > 0`;
            
            let result: string;
            if (config.settings.isDdevActive) {
                result = await localhostMagentoRootExec(`ddev mysql -e "${query}"`, config, true) as string;
            } else {
                result = await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${query}"`, config, true) as string;
            }
            
            if (!result) {
                return [];
            }
            
            // Parse store IDs from result
            const lines = String(result).split('\n').filter(l => l && !l.startsWith('store_id'));
            return lines.map(line => line.trim()).filter(id => id);
        } catch (err) {
            console.error('Error fetching store IDs:', err);
            return [];
        }
    }
    
    /**
     * Fetch all valid website IDs from Magento
     */
    async getValidWebsiteIds(config: any): Promise<string[]> {
        try {
            const query = `SELECT website_id FROM store_website WHERE website_id > 0`;
            
            let result: string;
            if (config.settings.isDdevActive) {
                result = await localhostMagentoRootExec(`ddev mysql -e "${query}"`, config, true) as string;
            } else {
                result = await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${query}"`, config, true) as string;
            }
            
            if (!result) {
                return [];
            }
            
            // Parse website IDs from result
            const lines = String(result).split('\n').filter(l => l && !l.startsWith('website_id'));
            return lines.map(line => line.trim()).filter(id => id);
        } catch (err) {
            console.error('Error fetching website IDs:', err);
            return [];
        }
    }
    
    /**
     * Validate if a store ID exists
     * Accepts '0' (default scope) as always valid
     */
    async isValidStoreId(storeId: string, config: any, validStoreIds?: string[]): Promise<boolean> {
        // Default scope (0) is always valid
        if (storeId === '0') {
            return true;
        }
        
        // Use cached list if provided
        if (validStoreIds) {
            return validStoreIds.includes(storeId);
        }
        
        // Otherwise fetch
        const storeIds = await this.getValidStoreIds(config);
        return storeIds.includes(storeId);
    }
    
    /**
     * Validate if a website ID exists
     */
    async isValidWebsiteId(websiteId: string, config: any, validWebsiteIds?: string[]): Promise<boolean> {
        // Use cached list if provided
        if (validWebsiteIds) {
            return validWebsiteIds.includes(websiteId);
        }
        
        // Otherwise fetch
        const websiteIds = await this.getValidWebsiteIds(config);
        return websiteIds.includes(websiteId);
    }
}
