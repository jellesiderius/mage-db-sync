import { localhostMagentoRootExec } from '../utils/Console';

/**
 * Service to map Magento stores to WordPress multisite blogs
 * using the wordpress/multisite/blog_id configuration
 */
export class WordpressMultisiteMapper {
    /**
     * Fetch wordpress/multisite/blog_id mappings from Magento database
     * Returns a mapping of blog_id -> { scope, scope_id, store/website URL }
     */
    async fetchMagentoBlogIdMappings(config: any): Promise<Record<string, {scope: string, scopeId: string, url: string}>> {
        const mappings: Record<string, {scope: string, scopeId: string, url: string}> = {};
        
        try {
            // Query wordpress/multisite/blog_id from core_config_data
            // Include 'default' scope for main site mapping
            const query = `SELECT scope, scope_id, value FROM core_config_data WHERE path = 'wordpress/multisite/blog_id' AND scope IN ('default', 'stores', 'websites')`;
            
            let result: string;
            if (config.settings.isDdevActive) {
                result = await localhostMagentoRootExec(`ddev mysql -e "${query}"`, config, true) as string;
            } else {
                result = await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${query}"`, config, true) as string;
            }
            
            if (!result) {
                return mappings;
            }
            
            // Parse the result
            const lines = String(result).split('\n').filter(l => l && !l.startsWith('scope'));
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const scope = parts[0]; // 'default', 'stores', or 'websites'
                    const scopeId = parts[1]; // scope_id (0 for default, store_id, or website_id)
                    let blogId = parts[2]; // WordPress blog_id from Magento config
                    
                    // WordPress multisite: main site is always blog_id 1, not 0
                    // Convert blog_id '0' to '1' for the default/main WordPress site
                    if (blogId === '0') {
                        blogId = '1';
                    }
                    
                    // Fetch the base URL for this scope
                    const url = await this.fetchScopeUrl(config, scope, scopeId);
                    
                    if (url) {
                        mappings[blogId] = {
                            scope,
                            scopeId,
                            url
                        };
                    }
                }
            }
            
            return mappings;
        } catch (err) {
            console.error('Error fetching Magento blog ID mappings:', err);
            return mappings;
        }
    }
    
    /**
     * Fetch the base URL for a specific Magento store or website
     * Handles 'default', 'stores', and 'websites' scopes
     * For 'websites' scope, finds stores belonging to that website
     */
    private async fetchScopeUrl(config: any, scope: string, scopeId: string): Promise<string | null> {
        try {
            let query: string;
            
            if (scope === 'websites') {
                // For websites, we need to find a store that belongs to this website
                // and get its base_url, since URLs are stored at store level, not website level
                query = `
                    SELECT ccd.value 
                    FROM core_config_data ccd
                    JOIN store s ON s.store_id = ccd.scope_id
                    WHERE ccd.path = 'web/secure/base_url' 
                    AND ccd.scope = 'stores'
                    AND s.website_id = ${scopeId}
                    LIMIT 1
                `.trim().replace(/\s+/g, ' ');
            } else {
                // For 'default' and 'stores' scopes, query directly
                query = `SELECT value FROM core_config_data WHERE path = 'web/secure/base_url' AND scope = '${scope}' AND scope_id = '${scopeId}' LIMIT 1`;
            }
            
            let result: string;
            if (config.settings.isDdevActive) {
                result = await localhostMagentoRootExec(`ddev mysql -e "${query}"`, config, true) as string;
            } else {
                result = await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${query}"`, config, true) as string;
            }
            
            if (!result) {
                return null;
            }
            
            // Parse the URL from result
            const lines = String(result).split('\n').filter(l => l && !l.startsWith('value'));
            if (lines.length > 0) {
                let url = lines[0].trim();
                
                // Remove protocol and trailing slash
                url = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                
                // Extract just the domain (remove path if present)
                const domain = url.split('/')[0];
                
                return domain;
            }
            
            return null;
        } catch (err) {
            console.error(`Error fetching URL for ${scope} ${scopeId}:`, err);
            return null;
        }
    }
    
    /**
     * Convert Magento-based mapping to WordPress domain mapping format
     * Returns { blog_id: domain } ready to use
     */
    convertToWordpressDomainMapping(magentoBlogMappings: Record<string, {scope: string, scopeId: string, url: string}>): Record<string, string> {
        const wordpressDomainMapping: Record<string, string> = {};
        
        for (const [blogId, data] of Object.entries(magentoBlogMappings)) {
            if (data.url) {
                wordpressDomainMapping[blogId] = data.url;
            }
        }
        
        return wordpressDomainMapping;
    }
}
