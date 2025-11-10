# WordPress Multisite Support

## Overview

mage-db-sync now includes **automatic WordPress Multisite detection and configuration** for local development environments.

## Features

### Automatic Detection
- ✅ Detects if WordPress installation is single-site or multisite
- ✅ Identifies multisite type (subdomain vs subdirectory)
- ✅ Automatically configures all sites in the network

### Multisite Types Supported

#### 1. Subdomain Multisite
Example production setup:
```
site1.example.com
site2.example.com
blog.example.com
```

Converted to local:
```
site1.localhost.test
site2.localhost.test
blog.localhost.test
```

#### 2. Subdirectory Multisite
Example production setup:
```
example.com
example.com/site1
example.com/site2
example.com/blog
```

Converted to local:
```
localhost.test
localhost.test/site1
localhost.test/site2
localhost.test/blog
```

## What Gets Configured

### Database Tables Updated
1. **`wp_site`** - Network domain
2. **`wp_blogs`** - All site domains
3. **`wp_options`** - Main site URLs (siteurl, home)
4. **`wp_X_options`** - Subsite URLs (wp_2_options, wp_3_options, etc.)
5. **`wp_domain_mapping`** - Cleared if domain mapping plugin is active

### URL Replacements
- Replaces production domain with local domain
- Converts HTTPS to HTTP (or keeps HTTPS for DDEV)
- Updates all serialized data using WP-CLI `search-replace --network`

## Usage

### Standard Flow

1. **Download WordPress Database**
   ```bash
   mage-db-sync
   ```
   - Select your database
   - Choose "Download wordpress database? **yes**"

2. **Import and Configure**
   - Choose "Import and configure WordPress database? **yes**"
   - The tool will automatically:
     - ✅ Detect multisite configuration
     - ✅ Configure all sites in the network
     - ✅ Update URLs for local development
     - ✅ Create admin user

### Output Example

```
✔ Import Wordpress database to localhost
  ✔ Importing database
  ✔ Detected WordPress Multisite (subdomain)
  ✔ Configured all sites for subdomain multisite
  ✔ Creating admin user
  ✔ Cleaning up
```

## Requirements

### For Multisite Support
- WordPress Multisite installation with `wp_blogs` and `wp_site` tables
- WP-CLI installed locally (for non-DDEV environments)

### Database Configuration

Set `"wordpress": true` in your database config:

```json
{
  "databases": {
    "my-wordpress-site": {
      "username": "user",
      "server": "example.com",
      "wordpress": true,
      ...
    }
  }
}
```

## How It Works

### Detection Phase
1. Checks for `wp_blogs` table existence
2. Reads `wp_sitemeta` table for `subdomain_install` value
3. Stores multisite configuration for later tasks

### Configuration Phase

#### For Subdomain Multisite:
1. Updates network domain in `wp_site`
2. Replaces all subdomain domains in `wp_blogs`
3. Updates main site options
4. Discovers and updates all subsite option tables
5. Uses WP-CLI search-replace with `--network` flag
6. Clears domain mapping if present

#### For Subdirectory Multisite:
1. Updates network domain in `wp_site`
2. Sets all sites to same domain in `wp_blogs`
3. Uses WP-CLI search-replace with `--network` flag
4. Clears domain mapping if present

## Advanced Configuration

### Custom Local Domains (Future Enhancement)

You can configure custom domains for each subsite by adding a configuration file in your project:

```json
// .mage-db-sync-wordpress-multisite.json
{
  "domainMapping": {
    "site1.production.com": "site1.local.test",
    "site2.production.com": "site2.local.test",
    "blog.production.com": "blog.local.test"
  }
}
```

*(Note: This feature is not yet implemented but the architecture supports it)*

## Troubleshooting

### Multisite Not Detected
- Verify `wp_blogs` and `wp_site` tables exist in database
- Check that `wp-config.php` has `MULTISITE` constant defined

### Subdomain Sites Not Working Locally
For subdomain multisite, you need to configure your local DNS:

**Option 1: Using /etc/hosts**
```bash
# Add to /etc/hosts
127.0.0.1 site1.localhost.test
127.0.0.1 site2.localhost.test
127.0.0.1 blog.localhost.test
```

**Option 2: Using dnsmasq (Recommended)**
```bash
# Install dnsmasq
brew install dnsmasq

# Configure wildcard DNS
echo 'address=/.test/127.0.0.1' > /usr/local/etc/dnsmasq.conf

# Start dnsmasq
sudo brew services start dnsmasq
```

**Option 3: DDEV (Easiest)**
DDEV automatically handles subdomain routing - no configuration needed!

### Admin Not Working
If you can't log in to wp-admin after import:

```bash
cd wp
wp super-admin add developmentadmin --network
```

## Technical Details

### Tables Modified
- `wp_site` - Network configuration
- `wp_blogs` - Site list and domains
- `wp_options` - Main site settings
- `wp_X_options` - Subsite settings (where X is blog_id)
- `wp_sitemeta` - Network settings (read-only for detection)
- `wp_domain_mapping` - Domain mapping plugin (cleared)

### WP-CLI Commands Used (Non-DDEV)
```bash
wp search-replace 'https://old.com' 'http://new.test' --network --skip-columns=guid
```

The `--network` flag ensures all subsites are updated, and `--skip-columns=guid` prevents breaking post GUIDs.

## Comparison: Single Site vs Multisite

| Feature | Single Site | Multisite |
|---------|-------------|-----------|
| Detection | Automatic | Automatic |
| URL Replacement | Simple REPLACE | Complex with subsites |
| Domain Mapping | N/A | Automatically cleared |
| Admin User | Single | Super Admin |
| WP-CLI | Basic commands | `--network` flag |

## Future Enhancements

Potential future features:
- [ ] Custom domain mapping configuration file
- [ ] Selective subsite import (choose which sites to import)
- [ ] Multisite-to-single-site conversion
- [ ] Preserve domain mapping with local domains
- [ ] Support for WordPress MU Domain Mapping plugin

## Credits

Multisite support automatically detects and configures:
- Subdomain networks
- Subdirectory networks
- Domain mapping plugins
- All subsite configurations

No manual configuration required! 🎉
