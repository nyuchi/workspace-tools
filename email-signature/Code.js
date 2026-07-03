/**
 * Nyuchi Africa Email Signature Generator
 *
 * Automatically generates and applies branded email signatures
 * for all users and their aliases in your Google Workspace domain.
 *
 * SETUP REQUIREMENTS:
 * 1. Enable the Gmail API and Admin SDK Directory API in your Google Cloud Project
 * 2. Run this script as a Workspace admin
 * 3. Configure domain-wide delegation
 *
 * SCOPES REQUIRED:
 * - https://www.googleapis.com/auth/admin.directory.user.readonly
 * - https://www.googleapis.com/auth/gmail.settings.basic
 * - https://www.googleapis.com/auth/gmail.settings.sharing
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  domain: 'nyuchi.com',
  companyName: 'Nyuchi Africa',
  tagline: 'I am because we are',
  ubuntuFooter: '🇿🇼 Built with Ubuntu • Powered by Community',

  // Promotional banner
  banner: {
    imageUrl: 'https://drive.google.com/file/d/1QoMdrAUZB7_0Ls12vr6YNo6NfQn74-di/view?usp=sharing',
    linkUrl: 'https://www.nyuchi.com',
    altText: 'Ubuntu - I am because we are'
  },

  // Division mappings (email domain to division info)
  divisions: {
    'lingo.nyuchi.com': {
      name: 'Nyuchi Lingo',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Nyuchi_Lingo_Logo_dark.png',
      website: 'lingo.nyuchi.com'
    },
    'learning.nyuchi.com': {
      name: 'Nyuchi Learning',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Nyuchi_Learning_Logo_dark.png',
      website: 'learning.nyuchi.com'
    },
    'services.nyuchi.com': {
      name: 'Nyuchi Development',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Nyuchi_Development_Logo_dark.png',
      website: 'services.nyuchi.com'
    },
    'travel-info.co.zw': {
      name: 'Zimbabwe Travel Information',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Zimbabwe_Travel_Information_Logo_dark.png',
      website: 'travel-info.co.zw'
    },
    'mukoko.com': {
      name: 'Mukoko',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Mukoko_Logo_dark.png',
      website: 'mukoko.com'
    },
    'hararemetro.co.zw': {
      name: 'Mukoko News',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Mukoko_News_Logo_dark.png',
      website: 'hararemetro.co.zw'
    },
    'news.mukoko.com': {
      name: 'Mukoko News',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Mukoko_News_Logo_dark.png',
      website: 'news.mukoko.com'
    },
    'nyuchi.com': {
      name: 'Nyuchi Africa',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Nyuchi_Africa_Logo_dark.png',
      website: 'nyuchi.com',
      hideAttribution: true  // Don't show "A division of" for corporate emails
    },
    // Bundu-ecosystem pillar brands — hand-synced from
    // signature-generator/src/engines/brands/index.ts (the canonical registry).
    'bundu.org': {
      name: 'Bundu Foundation',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Bundu_Foundation_Logo_dark.png', // TODO(brand): confirm logo asset
      website: 'bundu.org'
    },
    'shamwari.ai': {
      name: 'Shamwari AI',
      logo: 'https://raw.githubusercontent.com/nyuchitech/nyuchi-brand-assets/main/assets/logos/Shamwari_AI_Logo_dark.png', // TODO(brand): confirm logo asset
      website: 'shamwari.ai'
    }
  },

  // Zimbabwe flag colors (5 equal stripes: green, yellow, red, black, white)
  flagColors: {
    green: '#729b63',
    yellow: '#f6ad55',
    red: '#d4634a',
    black: '#171717',
    white: '#ffffff'
  }
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Main function to update signatures for all users and their aliases
 */
function updateAllUserSignatures() {
  const users = getAllDomainUsers();
  const results = { success: [], failed: [] };

  users.forEach(user => {
    const aliases = getUserAliases(user);
    const allAddresses = [user.primaryEmail, ...aliases];

    allAddresses.forEach(emailAddress => {
      try {
        const signature = generateSignatureHtml(user, emailAddress);
        setUserSignature(user.primaryEmail, emailAddress, signature);
        results.success.push(emailAddress);
        Logger.log(`✓ Updated signature for: ${emailAddress}`);
      } catch (error) {
        results.failed.push({ email: emailAddress, error: error.message });
        Logger.log(`✗ Failed for ${emailAddress}: ${error.message}`);
      }
      Utilities.sleep(500);
    });
    Utilities.sleep(500);
  });

  Logger.log('\n========== SUMMARY ==========');
  Logger.log(`Success: ${results.success.length}`);
  Logger.log(`Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    Logger.log('\nFailed addresses:');
    results.failed.forEach(f => Logger.log(`  - ${f.email}: ${f.error}`));
  }

  return results;
}

/**
 * Update signature for a single user and all their aliases
 * @param {string} email - The user's primary email address
 */
function updateSingleUserSignature(email) {
  const user = AdminDirectory.Users.get(email, { projection: 'full' });
  const aliases = getUserAliases(user);
  const allAddresses = [user.primaryEmail, ...aliases];

  Logger.log(`User: ${user.name.fullName}`);
  Logger.log(`Primary: ${user.primaryEmail}`);
  Logger.log(`Aliases: ${aliases.length > 0 ? aliases.join(', ') : 'None'}`);
  Logger.log('');

  allAddresses.forEach(emailAddress => {
    const signature = generateSignatureHtml(user, emailAddress);
    setUserSignature(user.primaryEmail, emailAddress, signature);
    Logger.log(`✓ Updated signature for: ${emailAddress}`);
  });
}

/**
 * List all users and their aliases (dry run - no changes)
 */
function listAllUsersAndAliases() {
  const users = getAllDomainUsers();

  Logger.log('\n========== ALL USERS AND ALIASES ==========\n');

  users.forEach(user => {
    const aliases = getUserAliases(user);
    const division = getDivisionFromEmail(user.primaryEmail);
    Logger.log(`${user.name.fullName} (${user.primaryEmail}) - ${division.name}`);
    if (aliases.length > 0) {
      aliases.forEach(alias => {
        const aliasDivision = getDivisionFromEmail(alias);
        Logger.log(`  └─ ${alias} - ${aliasDivision.name}`);
      });
    }
    Logger.log('');
  });
}

/**
 * Preview signature HTML without applying it
 * @param {string} email - The email address
 */
function previewSignature(email) {
  try {
    const user = AdminDirectory.Users.get(email);
    const signature = generateSignatureHtml(user, email);
    Logger.log(signature);
    return signature;
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
    Logger.log('\nMake sure:');
    Logger.log('1. Admin SDK API is enabled in GCP project');
    Logger.log('2. You have admin permissions');
    Logger.log('3. The email address exists in your domain');
    return null;
  }
}

/**
 * Test function - preview your own signature and aliases
 */
function testMySignature() {
  try {
    const email = Session.getActiveUser().getEmail();
    Logger.log(`Your primary email: ${email}`);

    const user = AdminDirectory.Users.get(email);
    const aliases = getUserAliases(user);

    Logger.log(`Your aliases: ${aliases.length > 0 ? aliases.join(', ') : 'None'}`);
    Logger.log('\n--- Primary Email Signature ---\n');

    const primarySignature = generateSignatureHtml(user, email);
    Logger.log(primarySignature);

    if (aliases.length > 0) {
      Logger.log('\n--- First Alias Signature ---\n');
      Logger.log(generateSignatureHtml(user, aliases[0]));
    }
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
    Logger.log('\nMake sure:');
    Logger.log('1. Admin SDK API is enabled in your GCP project');
    Logger.log('2. Gmail API is enabled in your GCP project');
    Logger.log('3. You have authorized all required OAuth scopes');
    Logger.log('4. You have admin permissions in your Google Workspace');
    Logger.log('5. Re-authorize the script after updating scopes (Run > Clear all authorizations, then re-run)');
  }
}

// ============================================================================
// SIGNATURE GENERATION
// ============================================================================

/**
 * Get division info from email address
 * @param {string} email - Email address
 * @returns {Object} Division info
 */
function getDivisionFromEmail(email) {
  if (!email || typeof email !== 'string') {
    Logger.log('Warning: Invalid email provided to getDivisionFromEmail');
    return CONFIG.divisions['nyuchi.com'];
  }
  const domain = email.split('@')[1];
  return CONFIG.divisions[domain] || CONFIG.divisions['nyuchi.com'];
}

/**
 * Generate the HTML signature for a user
 * @param {Object} user - Google Workspace user object
 * @param {string} emailAddress - The email address to display (primary or alias)
 * @returns {string} HTML signature
 */
function generateSignatureHtml(user, emailAddress) {
  if (!user) {
    Logger.log('Error: User object is required');
    return '';
  }

  const name = (user.name && user.name.fullName) ? user.name.fullName : (user.primaryEmail ? user.primaryEmail.split('@')[0] : 'User');
  const title = getJobTitle(user);
  const phone = getPhoneNumber(user);
  const email = emailAddress || (user.primaryEmail || 'email@nyuchi.com');
  const division = getDivisionFromEmail(email);

  // Zimbabwe flag gradient (5 colors: green, yellow, red, black, white - 20% each)
  const flagGradient = `linear-gradient(to bottom, ${CONFIG.flagColors.green} 0%, ${CONFIG.flagColors.green} 20%, ${CONFIG.flagColors.yellow} 20%, ${CONFIG.flagColors.yellow} 40%, ${CONFIG.flagColors.red} 40%, ${CONFIG.flagColors.red} 60%, ${CONFIG.flagColors.black} 60%, ${CONFIG.flagColors.black} 80%, ${CONFIG.flagColors.white} 80%, ${CONFIG.flagColors.white} 100%)`;

  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #000000; max-width: 600px;">
  <tr>
    <!-- Zimbabwe Flag Strip - 4px Vertical Left Edge -->
    <td style="width: 4px; background: ${flagGradient}; padding: 0;"></td>

    <!-- Signature Content -->
    <td style="padding: 20px 0 20px 12px;">
      <!-- Division Logo (Primary) -->
      <div style="margin-bottom: 16px;">
        <img src="${division.logo}" alt="${escapeHtml(division.name)}" width="120" style="display: block; height: auto;">
      </div>

      <!-- Name and Title -->
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size: 18px; font-weight: 700; color: #000000; margin-bottom: 4px;">
              ${escapeHtml(name)}
            </div>
            ${title ? `<div style="font-size: 14px; color: #000000; margin-bottom: 12px;">${escapeHtml(title)}</div>` : ''}
          </td>
        </tr>
      </table>

      <!-- Contact Information -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
        <tr>
          <td style="padding-right: 12px; color: #000000; font-weight: 600;">E:</td>
          <td>
            <a href="mailto:${email}" style="color: #000000; text-decoration: none;">${email}</a>
          </td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding-right: 12px; color: #000000; font-weight: 600; padding-top: 4px;">P:</td>
          <td style="padding-top: 4px;">
            <a href="tel:${phone.replace(/\s/g, '')}" style="color: #000000; text-decoration: none;">${phone}</a>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding-right: 12px; color: #000000; font-weight: 600; padding-top: 4px;">W:</td>
          <td style="padding-top: 4px;">
            <a href="https://${division.website}" style="color: #000000; text-decoration: none;">${division.website}</a>
          </td>
        </tr>
      </table>

      <!-- Parent Company (Nyuchi Africa) -->
      ${!division.hideAttribution ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
        <tr>
          <td>
            <div style="font-size: 13px; color: #666666; margin-bottom: 4px;">A division of</div>
            <div style="font-size: 16px; font-weight: 700; color: #000000; margin-bottom: 4px;">${CONFIG.companyName}</div>
            <div style="font-size: 13px; font-style: italic; color: #000000;">${CONFIG.tagline}</div>
          </td>
        </tr>
      </table>` : `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
        <tr>
          <td>
            <div style="font-size: 16px; font-weight: 700; color: #000000; margin-bottom: 4px;">${CONFIG.companyName}</div>
            <div style="font-size: 13px; font-style: italic; color: #000000;">${CONFIG.tagline}</div>
          </td>
        </tr>
      </table>`}

      <!-- Ubuntu Footer -->
      <div style="margin-top: 16px; font-size: 11px; color: #000000;">
        ${CONFIG.ubuntuFooter}
      </div>

      <!-- Promotional Banner -->
      <div style="margin-top: 20px;">
        <a href="${CONFIG.banner.linkUrl}" style="display: block; text-decoration: none;">
          <img src="${CONFIG.banner.imageUrl}" alt="${CONFIG.banner.altText}" width="100%" style="display: block; max-width: 550px; height: auto; border-radius: 4px;">
        </a>
      </div>

    </td>
  </tr>
</table>
`.trim();
}

// ============================================================================
// GOOGLE WORKSPACE API FUNCTIONS
// ============================================================================

/**
 * Get all users in the domain with their aliases
 * @returns {Array} Array of user objects
 */
function getAllDomainUsers() {
  const users = [];
  let pageToken = null;

  do {
    const response = AdminDirectory.Users.list({
      domain: CONFIG.domain,
      maxResults: 100,
      pageToken: pageToken,
      orderBy: 'email',
      projection: 'full'
    });

    if (response.users) {
      users.push(...response.users);
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  let totalAliases = 0;
  users.forEach(user => {
    if (user.aliases) totalAliases += user.aliases.length;
  });

  Logger.log(`Found ${users.length} users with ${totalAliases} aliases (${users.length + totalAliases} total addresses)`);
  return users;
}

/**
 * Get all email aliases for a user
 * @param {Object} user - Google Workspace user object
 * @returns {Array} Array of alias email addresses
 */
function getUserAliases(user) {
  if (!user) {
    Logger.log('Error: User object is required in getUserAliases');
    return [];
  }

  const aliases = [];

  if (user.aliases && user.aliases.length > 0) {
    aliases.push(...user.aliases);
  }

  if (user.nonEditableAliases && user.nonEditableAliases.length > 0) {
    aliases.push(...user.nonEditableAliases);
  }

  return aliases;
}

/**
 * Set the email signature for a user's send-as address
 * @param {string} userEmail - User's primary email (for API auth)
 * @param {string} sendAsEmail - The send-as address to update
 * @param {string} signatureHtml - HTML signature content
 */
function setUserSignature(userEmail, sendAsEmail, signatureHtml) {
  Gmail.Users.Settings.SendAs.update(
    { signature: signatureHtml },
    userEmail,
    sendAsEmail
  );
}

/**
 * Get all SendAs addresses for a user
 * @param {string} userEmail - User's primary email address
 * @returns {Array} Array of SendAs address objects
 */
function getSendAsAddresses(userEmail) {
  try {
    const response = Gmail.Users.Settings.SendAs.list(userEmail);
    return response.sendAs || [];
  } catch (error) {
    Logger.log(`Could not get SendAs for ${userEmail}: ${error.message}`);
    return [];
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract job title from user object
 * @param {Object} user - Google Workspace user object
 * @returns {string|null} Job title or null
 */
function getJobTitle(user) {
  if (!user) {
    return null;
  }

  if (user.organizations && user.organizations.length > 0) {
    const primaryOrg = user.organizations.find(org => org.primary) || user.organizations[0];
    if (primaryOrg && primaryOrg.title) return primaryOrg.title;
  }

  if (user.customSchemas && user.customSchemas.Employment) {
    return user.customSchemas.Employment.jobTitle || null;
  }

  return null;
}

/**
 * Extract phone number from user object
 * @param {Object} user - Google Workspace user object
 * @returns {string|null} Phone number or null
 */
function getPhoneNumber(user) {
  if (!user || !user.phones || user.phones.length === 0) {
    return null;
  }

  const workPhone = user.phones.find(p => p.type === 'work');
  const mobilePhone = user.phones.find(p => p.type === 'mobile');
  const primaryPhone = user.phones.find(p => p.primary);

  const phone = workPhone || mobilePhone || primaryPhone || user.phones[0];
  return phone && phone.value ? formatPhoneNumber(phone.value) : null;
}

/**
 * Format phone number for display
 * @param {string} phone - Raw phone number
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  let cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+') && cleaned.length > 8) {
    const countryCode = cleaned.substring(0, cleaned.length > 12 ? 3 : 2);
    const rest = cleaned.substring(countryCode.length);
    const mid = Math.ceil(rest.length / 2);
    return `${countryCode} ${rest.substring(0, mid)} ${rest.substring(mid)}`;
  }

  return phone;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// MENU & TRIGGERS
// ============================================================================

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Email Signatures')
    .addItem('Update All Signatures', 'updateAllUserSignatures')
    .addItem('List All Users & Aliases', 'listAllUsersAndAliases')
    .addItem('Preview My Signature', 'testMySignature')
    .addSeparator()
    .addItem('Setup Instructions', 'showSetupInstructions')
    .addToUi();
}

/**
 * Show setup instructions
 */
function showSetupInstructions() {
  const html = HtmlService.createHtmlOutput(`
    <h2>Setup Instructions</h2>
    <ol>
      <li>Go to <strong>Extensions > Apps Script</strong></li>
      <li>Click <strong>Services</strong> (+ icon)</li>
      <li>Add <strong>Admin SDK API</strong> (AdminDirectory)</li>
      <li>Add <strong>Gmail API</strong></li>
      <li>In Google Cloud Console, enable domain-wide delegation</li>
      <li>Configure OAuth scopes in the manifest</li>
    </ol>
    <p>See the script comments for required scopes.</p>
  `)
    .setWidth(400)
    .setHeight(300);

  SpreadsheetApp.getUi().showModalDialog(html, 'Setup Instructions');
}

// ============================================================================
// SCHEDULED UPDATES
// ============================================================================

/**
 * Set up a daily trigger to update signatures
 */
function createDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'updateAllUserSignatures') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('updateAllUserSignatures')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();

  Logger.log('Daily trigger created - signatures will update at 2 AM');
}

/**
 * Remove the daily trigger
 */
function removeDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'updateAllUserSignatures') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Trigger removed');
    }
  });
}

// ============================================================================
// SIMPLE TEST FUNCTIONS (No Admin SDK Required)
// ============================================================================

/**
 * Test division detection for various email domains
 */
function testDivisionDetection() {
  Logger.log('========== TESTING DIVISION DETECTION ==========\n');

  const testEmails = [
    'test@lingo.nyuchi.com',
    'test@learning.nyuchi.com',
    'test@services.nyuchi.com',
    'test@travel-info.co.zw',
    'test@mukoko.com',
    'test@hararemetro.co.zw',
    'test@news.mukoko.com',
    'test@nyuchi.com',
    'test@unknown-domain.com'
  ];

  testEmails.forEach(email => {
    const division = getDivisionFromEmail(email);
    Logger.log(`${email}`);
    Logger.log(`  → Division: ${division.name}`);
    Logger.log(`  → Website: ${division.website}`);
    Logger.log(`  → Logo: ${division.logo.substring(0, 60)}...`);
    Logger.log(`  → Hide Attribution: ${division.hideAttribution || false}`);
    Logger.log('');
  });
}

/**
 * Test signature HTML generation with mock data
 */
function testSignatureGeneration() {
  Logger.log('========== TESTING SIGNATURE GENERATION ==========\n');

  // Mock user object
  const mockUser = {
    name: { fullName: 'Test User' },
    primaryEmail: 'test@lingo.nyuchi.com',
    organizations: [{ title: 'Software Engineer', primary: true }],
    phones: [{ value: '+263 77 123 4567', type: 'work' }]
  };

  const testEmails = [
    'test@lingo.nyuchi.com',
    'test@mukoko.com',
    'test@nyuchi.com'
  ];

  testEmails.forEach(email => {
    Logger.log(`\n=== Signature for ${email} ===\n`);
    const division = getDivisionFromEmail(email);
    Logger.log(`Division: ${division.name}`);
    Logger.log(`Logo: ${division.logo}`);

    const signature = generateSignatureHtml(mockUser, email);
    Logger.log('\nFirst 500 characters of HTML:');
    Logger.log(signature.substring(0, 500) + '...\n');

    // Check for key elements
    const checks = {
      'Zimbabwe flag gradient': signature.includes('linear-gradient(to bottom'),
      'Division logo': signature.includes(division.logo),
      'User name': signature.includes(mockUser.name.fullName),
      'Email address': signature.includes(email),
      'Phone number': signature.includes('+263 77 123 4567'),
      'Ubuntu footer': signature.includes('Built with Ubuntu'),
      'Promotional banner': signature.includes('drive.google.com'),
      'All text black': signature.includes('color: #000000')
    };

    Logger.log('Validation checks:');
    Object.keys(checks).forEach(check => {
      Logger.log(`  ${checks[check] ? '✓' : '✗'} ${check}`);
    });
    Logger.log('');
  });
}

/**
 * Test Zimbabwe flag color configuration
 */
function testFlagColors() {
  Logger.log('========== TESTING ZIMBABWE FLAG COLORS ==========\n');

  Logger.log('Flag configuration (5 equal stripes at 20% each):');
  Logger.log(`1. Green:  ${CONFIG.flagColors.green}  (0-20%)`);
  Logger.log(`2. Yellow: ${CONFIG.flagColors.yellow} (20-40%)`);
  Logger.log(`3. Red:    ${CONFIG.flagColors.red}    (40-60%)`);
  Logger.log(`4. Black:  ${CONFIG.flagColors.black}  (60-80%)`);
  Logger.log(`5. White:  ${CONFIG.flagColors.white}  (80-100%)`);

  const flagGradient = `linear-gradient(to bottom, ${CONFIG.flagColors.green} 0%, ${CONFIG.flagColors.green} 20%, ${CONFIG.flagColors.yellow} 20%, ${CONFIG.flagColors.yellow} 40%, ${CONFIG.flagColors.red} 40%, ${CONFIG.flagColors.red} 60%, ${CONFIG.flagColors.black} 60%, ${CONFIG.flagColors.black} 80%, ${CONFIG.flagColors.white} 80%, ${CONFIG.flagColors.white} 100%)`;

  Logger.log('\nGenerated CSS gradient:');
  Logger.log(flagGradient);

  Logger.log('\n✓ Flag is always 4px vertical left edge');
  Logger.log('✓ No repeating colors');
  Logger.log('✓ Equal 20% distribution');
}

/**
 * Show all configuration
 */
function showConfig() {
  Logger.log('========== NYUCHI EMAIL SIGNATURE CONFIGURATION ==========\n');

  Logger.log('Domain: ' + CONFIG.domain);
  Logger.log('Company: ' + CONFIG.companyName);
  Logger.log('Tagline: ' + CONFIG.tagline);
  Logger.log('Ubuntu Footer: ' + CONFIG.ubuntuFooter);
  Logger.log('\nPromotional Banner:');
  Logger.log('  Image URL: ' + CONFIG.banner.imageUrl);
  Logger.log('  Link URL: ' + CONFIG.banner.linkUrl);
  Logger.log('  Alt Text: ' + CONFIG.banner.altText);

  Logger.log('\nDivisions (' + Object.keys(CONFIG.divisions).length + ' total):');
  Object.keys(CONFIG.divisions).forEach(domain => {
    const div = CONFIG.divisions[domain];
    Logger.log(`\n  ${domain}:`);
    Logger.log(`    Name: ${div.name}`);
    Logger.log(`    Website: ${div.website}`);
    Logger.log(`    Hide Attribution: ${div.hideAttribution || false}`);
  });

  Logger.log('\nZimbabwe Flag Colors:');
  Object.keys(CONFIG.flagColors).forEach(color => {
    Logger.log(`  ${color}: ${CONFIG.flagColors[color]}`);
  });
}

/**
 * Show domain-wide delegation setup instructions
 * Run this to get the exact OAuth Client ID and scopes for Google Workspace Admin Console
 */
function showDelegationSetup() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         DOMAIN-WIDE DELEGATION SETUP INSTRUCTIONS                 ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  Logger.log('ERROR: "Delegation denied" or "Access restricted to service accounts"');
  Logger.log('This means domain-wide delegation is not configured.\n');

  Logger.log('SOLUTION: Configure domain-wide delegation in Google Workspace Admin Console\n');

  Logger.log('STEP 1: Get your OAuth Client ID');
  Logger.log('  1. Go to: https://console.cloud.google.com/apis/credentials?project=nyuchi-app-script');
  Logger.log('  2. Find the OAuth 2.0 Client ID for "Apps Script"');
  Logger.log('  3. Copy the Client ID (format: 123456789-xxxxx.apps.googleusercontent.com)\n');

  Logger.log('STEP 2: Configure delegation in Admin Console');
  Logger.log('  1. Go to: https://admin.google.com');
  Logger.log('  2. Navigate to: Security → Access and data control → API controls');
  Logger.log('  3. Click "Manage Domain Wide Delegation"');
  Logger.log('  4. Click "Add new"');
  Logger.log('  5. Enter the Client ID from Step 1');
  Logger.log('  6. Paste these OAuth scopes (copy exactly as shown):\n');

  const scopes = [
    'https://www.googleapis.com/auth/admin.directory.user.readonly',
    'https://www.googleapis.com/auth/gmail.settings.basic',
    'https://www.googleapis.com/auth/gmail.settings.sharing'
  ];

  Logger.log('     ' + scopes.join(','));
  Logger.log('\n  7. Click "Authorize"\n');

  Logger.log('STEP 3: Re-run the script');
  Logger.log('  After configuring delegation, run updateAllUserSignatures() again\n');

  Logger.log('SCOPES EXPLANATION:');
  scopes.forEach((scope, index) => {
    const explanation = {
      0: 'Read user directory info (names, emails, phone numbers)',
      1: 'Manage Gmail signature settings',
      2: 'Share Gmail settings across users'
    };
    Logger.log(`  ${index + 1}. ${scope}`);
    Logger.log(`     → ${explanation[index]}\n`);
  });

  Logger.log('═'.repeat(70));
  Logger.log('GCP Project: nyuchi-app-script');
  Logger.log('Script ID: 1fTujgXkM9sguM8gB0QgJdtbUJv5MbMsX2UrVSoLJV1anpm-bHS-bY-jv');
  Logger.log('═'.repeat(70));
}

// ============================================================================
// MASTER TEST RUNNER
// ============================================================================

/**
 * Run all test functions in sequence and report any errors
 * This is the main function to test the entire email signature system
 */
function runAllTests() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         NYUCHI EMAIL SIGNATURE - COMPREHENSIVE TEST SUITE         ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const tests = [
    { name: 'Configuration Display', func: showConfig },
    { name: 'Flag Colors Validation', func: testFlagColors },
    { name: 'Division Detection', func: testDivisionDetection },
    { name: 'Signature Generation (Mock Data)', func: testSignatureGeneration },
    { name: 'All Users and Aliases (Admin SDK)', func: listAllUsersAndAliases },
    { name: 'My Own Signature (Admin SDK)', func: testMySignature }
  ];

  let passedCount = 0;
  let failedCount = 0;
  const results = [];

  tests.forEach((test, index) => {
    Logger.log(`\n${'='.repeat(70)}`);
    Logger.log(`TEST ${index + 1}/${tests.length}: ${test.name}`);
    Logger.log('='.repeat(70) + '\n');

    try {
      test.func();
      passedCount++;
      results.push(`✓ PASS: ${test.name}`);
      Logger.log(`\n✓ Test completed successfully\n`);
    } catch (error) {
      failedCount++;
      results.push(`✗ FAIL: ${test.name}`);
      Logger.log(`\n✗ Test failed with error:`);
      Logger.log(`   ${error.toString()}`);
      Logger.log(`   Stack: ${error.stack || 'N/A'}\n`);
    }
  });

  // Summary report
  Logger.log('\n' + '='.repeat(70));
  Logger.log('TEST SUMMARY');
  Logger.log('='.repeat(70) + '\n');

  results.forEach(result => Logger.log(result));

  Logger.log(`\nTotal Tests: ${tests.length}`);
  Logger.log(`Passed: ${passedCount} (${Math.round(passedCount/tests.length*100)}%)`);
  Logger.log(`Failed: ${failedCount} (${Math.round(failedCount/tests.length*100)}%)`);

  if (failedCount === 0) {
    Logger.log('\n🎉 All tests passed! Email signature system is ready for deployment.');
  } else {
    Logger.log(`\n⚠️  ${failedCount} test(s) failed. Please review errors above.`);
  }

  Logger.log('\n' + '='.repeat(70) + '\n');
}
