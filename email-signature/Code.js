/**
 * Nyuchi Africa Email Signature Generator
 *
 * Automatically applies branded email signatures for all users and their
 * aliases in your Google Workspace domain.
 *
 * SIGNATURE HTML COMES FROM THE WORKER RENDER API (Phase 0b of
 * docs/signature-console-plan.md): this script no longer carries its own
 * signature template. `fetchSignatureHtml()` POSTs to
 * https://tools.nyuchi.com/api/signature, which renders through the ONE
 * canonical engine (signature-generator/src/engines/signature).
 *
 * SETUP REQUIREMENTS:
 * 1. Enable the Gmail API and Admin SDK Directory API in your Google Cloud Project
 * 2. Run this script as a Workspace admin
 * 3. Configure domain-wide delegation
 * 4. Script Properties (Project Settings > Script Properties):
 *    - SIGNATURE_API_KEY  (required) — bearer token for the render API
 *    - SIGNATURE_API_URL  (optional) — base URL, default https://tools.nyuchi.com
 *
 * SCOPES REQUIRED:
 * - https://www.googleapis.com/auth/admin.directory.user.readonly
 * - https://www.googleapis.com/auth/gmail.settings.basic
 * - https://www.googleapis.com/auth/gmail.settings.sharing
 * - https://www.googleapis.com/auth/script.external_request
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  domain: 'nyuchi.com',

  // Promotional banner passed to the render API for every signature
  // (the retired inline template always included it).
  banner: {
    imageUrl: 'https://drive.google.com/file/d/1QoMdrAUZB7_0Ls12vr6YNo6NfQn74-di/view?usp=sharing',
    linkUrl: 'https://www.nyuchi.com',
    altText: 'Ubuntu - I am because we are'
  },

  // Division mappings (email domain to division info).
  // `name`/`website` are display metadata for logs; `brandSlug` is what gets
  // sent to the render API (one of: nyuchi, bundu, mukoko, shamwari, travel,
  // learning — BRAND_KEYS in signature-generator/src/engines/signature).
  // Divisions without their own signature identity in the engine render under
  // their parent brand's slug.
  divisions: {
    'lingo.nyuchi.com': {
      name: 'Nyuchi Lingo',
      website: 'lingo.nyuchi.com',
      brandSlug: 'nyuchi' // Nyuchi Africa division — no engine identity
    },
    'learning.nyuchi.com': {
      name: 'Nyuchi Learning',
      website: 'learning.nyuchi.com',
      brandSlug: 'learning'
    },
    'services.nyuchi.com': {
      name: 'Nyuchi Development',
      website: 'services.nyuchi.com',
      brandSlug: 'nyuchi' // Nyuchi Africa division — no engine identity
    },
    'travel-info.co.zw': {
      name: 'Zimbabwe Travel Information',
      website: 'travel-info.co.zw',
      brandSlug: 'travel'
    },
    'mukoko.com': {
      name: 'Mukoko',
      website: 'mukoko.com',
      brandSlug: 'mukoko'
    },
    'hararemetro.co.zw': {
      name: 'Mukoko News',
      website: 'hararemetro.co.zw',
      brandSlug: 'mukoko' // Mukoko division — no engine identity
    },
    'news.mukoko.com': {
      name: 'Mukoko News',
      website: 'news.mukoko.com',
      brandSlug: 'mukoko' // Mukoko division — no engine identity
    },
    'nyuchi.com': {
      name: 'Nyuchi Africa',
      website: 'nyuchi.com',
      brandSlug: 'nyuchi'
    },
    // Bundu-ecosystem pillar brands — hand-synced from
    // signature-generator/src/engines/brands/index.ts (the canonical registry).
    'bundu.org': {
      name: 'Bundu Foundation',
      website: 'bundu.org',
      brandSlug: 'bundu'
    },
    'shamwari.ai': {
      name: 'Shamwari AI',
      website: 'shamwari.ai',
      brandSlug: 'shamwari'
    }
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
    Logger.log('4. SIGNATURE_API_KEY is set in Script Properties (signature HTML comes from the tools.nyuchi.com API)');
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
    Logger.log('6. SIGNATURE_API_KEY is set in Script Properties (signature HTML comes from the tools.nyuchi.com API)');
  }
}

// ============================================================================
// SIGNATURE GENERATION
// ============================================================================

/**
 * Get division info from email address
 * @param {string} email - Email address
 * @returns {Object} Division info ({name, website, brandSlug})
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
 * Fetch signature HTML from the Worker render API.
 *
 * POST {base}/api/signature with a JSON body of
 * {brand, name, email, title?, phone?, whatsapp?, profileImage?, linkedin?,
 *  twitter?, facebook?, instagram?, promoBanner?, promoLink?}
 * and an Authorization: Bearer header. Returns the byte-locked engine HTML.
 *
 * There is deliberately NO local-template fallback: a failure throws so the
 * caller surfaces it (fail loud) instead of silently applying stale markup.
 *
 * Script Properties: SIGNATURE_API_KEY (required),
 * SIGNATURE_API_URL (optional, default https://tools.nyuchi.com).
 */
function fetchSignatureHtml(params) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('SIGNATURE_API_KEY');
  if (!apiKey) {
    throw new Error('SIGNATURE_API_KEY is not set in Script Properties. Add it under Project Settings > Script Properties before generating signatures.');
  }
  const baseUrl = (props.getProperty('SIGNATURE_API_URL') || 'https://tools.nyuchi.com').replace(/\/+$/, '');

  const response = UrlFetchApp.fetch(baseUrl + '/api/signature', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(params),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText() || '';
  if (code !== 200) {
    throw new Error('Signature API request failed (HTTP ' + code + ') for brand "' + params.brand + '": ' + body.slice(0, 300));
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error('Signature API returned invalid JSON (HTTP 200): ' + body.slice(0, 300));
  }
  if (!parsed || typeof parsed.html !== 'string' || !parsed.html) {
    throw new Error('Signature API response is missing the "html" field: ' + body.slice(0, 300));
  }
  return parsed.html;
}

/**
 * Generate the HTML signature for a user.
 *
 * Thin wrapper over the Worker render API — derives the same fields the old
 * inline template used (directory name/title/phone, division/brand from the
 * email domain, the CONFIG promo banner) and returns the canonical engine
 * HTML. The name and signature are kept; the inline template is gone.
 *
 * @param {Object} user - Google Workspace user object
 * @param {string} emailAddress - The email address to display (primary or alias)
 * @returns {string} HTML signature from the render API
 */
function generateSignatureHtml(user, emailAddress) {
  if (!user) {
    throw new Error('User object is required to generate a signature');
  }

  const name = (user.name && user.name.fullName) ? user.name.fullName : (user.primaryEmail ? user.primaryEmail.split('@')[0] : 'User');
  const title = getJobTitle(user);
  const phone = getPhoneNumber(user);
  const email = emailAddress || (user.primaryEmail || 'email@nyuchi.com');
  const division = getDivisionFromEmail(email);

  return fetchSignatureHtml({
    brand: division.brandSlug || 'nyuchi',
    name: name,
    email: email,
    title: title || '',
    phone: phone || '',
    promoBanner: CONFIG.banner.imageUrl,
    promoLink: CONFIG.banner.linkUrl
  });
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
// SIMPLE TEST FUNCTIONS
// ============================================================================
// testDivisionDetection/showConfig run offline; testSignatureGeneration calls
// the live render API, so SIGNATURE_API_KEY must be set in Script Properties
// (and SIGNATURE_API_URL if not using the default https://tools.nyuchi.com).

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

  let failed = 0;
  testEmails.forEach(email => {
    const division = getDivisionFromEmail(email);
    const ok = division && division.name && division.website && division.brandSlug;
    if (!ok) failed++;
    Logger.log(`${email}`);
    Logger.log(`  → Division: ${division.name}`);
    Logger.log(`  → Website: ${division.website}`);
    Logger.log(`  → API brand slug: ${division.brandSlug}`);
    Logger.log('');
  });
  Logger.log(failed === 0 ? 'PASS: testDivisionDetection' : `FAIL: testDivisionDetection — ${failed} email(s) resolved incompletely`);
}

/**
 * Test signature HTML generation with mock data (calls the render API)
 */
function testSignatureGeneration() {
  Logger.log('========== TESTING SIGNATURE GENERATION (render API) ==========\n');
  Logger.log('Note: requires SIGNATURE_API_KEY in Script Properties.\n');

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

  let failed = 0;
  testEmails.forEach(email => {
    Logger.log(`\n=== Signature for ${email} ===\n`);
    const division = getDivisionFromEmail(email);
    Logger.log(`Division: ${division.name} (API brand slug: ${division.brandSlug})`);

    const signature = generateSignatureHtml(mockUser, email);
    Logger.log('\nFirst 500 characters of HTML:');
    Logger.log(signature.substring(0, 500) + '...\n');

    // Check for key elements of the canonical engine output
    const checks = {
      'User name': signature.includes(mockUser.name.fullName),
      'Email address': signature.includes(email),
      'Phone number': signature.includes(getPhoneNumber(mockUser)),
      // Assert the exact configured banner URL — a bare host-substring
      // check reads like URL sanitization (trips CodeQL) and would also
      // pass on unrelated hosts.
      'Promotional banner': signature.includes(CONFIG.banner.imageUrl)
    };

    Logger.log('Validation checks:');
    Object.keys(checks).forEach(check => {
      if (!checks[check]) failed++;
      Logger.log(`  ${checks[check] ? '✓' : '✗'} ${check}`);
    });
    Logger.log('');
  });
  Logger.log(failed === 0 ? 'PASS: testSignatureGeneration' : `FAIL: testSignatureGeneration — ${failed} check(s) failed`);
}

/**
 * Show all configuration
 */
function showConfig() {
  Logger.log('========== NYUCHI EMAIL SIGNATURE CONFIGURATION ==========\n');

  Logger.log('Domain: ' + CONFIG.domain);
  Logger.log('Signature HTML: rendered by the tools.nyuchi.com API (SIGNATURE_API_KEY / SIGNATURE_API_URL in Script Properties)');
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
    Logger.log(`    API brand slug: ${div.brandSlug}`);
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
 *
 * Requires SIGNATURE_API_KEY in Script Properties (signature HTML is fetched
 * from the tools.nyuchi.com render API) plus Admin SDK access for the last
 * two tests.
 */
function runAllTests() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         NYUCHI EMAIL SIGNATURE - COMPREHENSIVE TEST SUITE         ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const tests = [
    { name: 'Configuration Display', func: showConfig },
    { name: 'Division Detection', func: testDivisionDetection },
    { name: 'Signature Generation (render API)', func: testSignatureGeneration },
    { name: 'All Users and Aliases (Admin SDK)', func: listAllUsersAndAliases },
    { name: 'My Own Signature (Admin SDK + render API)', func: testMySignature }
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
