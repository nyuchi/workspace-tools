/**
 * Nyuchi Email Signature Generator - Gmail Add-on
 *
 * Combined self-service and admin email signature generator for Nyuchi Africa brands.
 *
 * TWO TABS:
 * - User Tab: Individual users generate and apply their own signatures
 * - Admin Tab: Admins push signatures to all domain users
 *
 * SIGNATURE HTML COMES FROM THE WORKER RENDER API (Phase 0b of
 * docs/signature-console-plan.md): this script no longer carries its own
 * signature template. `fetchSignatureHtml()` POSTs to
 * https://tools.nyuchi.com/api/signature, which renders through the ONE
 * canonical engine (signature-generator/src/engines/signature). Required
 * Script Properties (Project Settings > Script Properties):
 * - SIGNATURE_API_KEY  (required) — bearer token for the render API
 * - SIGNATURE_API_URL  (optional) — base URL, default https://tools.nyuchi.com
 *
 * The BRANDS object below is now UI/display data only (dropdown labels,
 * preview cards, brand-default socials) — it no longer feeds any HTML
 * template. Brand identity in emitted signatures is owned by the engine.
 *
 * Supported Brands (see signature-generator/src/engines/brands/index.ts —
 * the canonical Bundu-ecosystem brand registry; this file is a hand-synced
 * copy because Apps Script cannot import npm modules):
 * - Bundu Foundation (bundu.org — the parent)
 * - Nyuchi Africa (and divisions: Lingo, Learning, Development, Foundation)
 * - Mukoko (and Mukoko News, Mukoko ID)
 * - Shamwari AI
 * - Zimbabwe Travel Information
 * - TELIA — Technology Leaders in Africa
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const BRANDS = {
  nyuchi: {
    name: 'Nyuchi Africa',
    tagline: 'I am because we are',
    website: 'nyuchi.com',
    websiteUrl: 'https://nyuchi.com',
    logo: 'https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_dark.svg',
    hideAttribution: true,
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/',
      facebook: 'https://facebook.com/nyuchigroup',
      instagram: 'https://instagram.com/nyuchi.africa'
    }
  },
  lingo: {
    name: 'Nyuchi Lingo',
    tagline: 'Language Learning for Africa',
    website: 'lingo.nyuchi.com',
    websiteUrl: 'https://lingo.nyuchi.com',
    logo: 'https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Lingo_Logo_dark.svg',
    parent: 'Nyuchi Africa',
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/',
      instagram: 'https://instagram.com/nyuchi.africa'
    }
  },
  learning: {
    name: 'Nyuchi Learning',
    tagline: 'Education for All',
    website: 'learning.nyuchi.com',
    websiteUrl: 'https://learning.nyuchi.com',
    logo: 'https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Learning_Logo_dark.svg',
    parent: 'Nyuchi Africa',
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/'
    }
  },
  development: {
    name: 'Nyuchi Development',
    tagline: 'Building Digital Africa',
    website: 'services.nyuchi.com',
    websiteUrl: 'https://services.nyuchi.com',
    logo: 'https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Development_Logo_dark.svg',
    parent: 'Nyuchi Africa',
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/'
    }
  },
  foundation: {
    name: 'Nyuchi Foundation',
    tagline: 'Empowering Communities',
    website: 'foundation.nyuchi.com',
    websiteUrl: 'https://foundation.nyuchi.com',
    logo: 'https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Foundation_Logo_dark.svg',
    parent: 'Nyuchi Africa',
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/'
    }
  },
  mukoko: {
    name: 'Mukoko',
    tagline: 'Your Digital Twin Ecosystem',
    website: 'mukoko.com',
    websiteUrl: 'https://mukoko.com',
    logo: 'https://assets.nyuchi.com/logos/mukoko/Mukoko_Logo_dark.png',
    socials: {
      facebook: 'https://facebook.com/mukokoafrica',
      instagram: 'https://instagram.com/mukoko.africa'
    }
  },
  mukokoNews: {
    name: 'Mukoko News',
    tagline: 'Pan-African Journalism',
    website: 'news.mukoko.com',
    websiteUrl: 'https://news.mukoko.com',
    logo: 'https://assets.nyuchi.com/logos/mukoko/Mukoko_News_Logo_dark.png',
    parent: 'Mukoko',
    socials: {
      facebook: 'https://facebook.com/mukokoafrica',
      instagram: 'https://instagram.com/mukoko.africa'
    }
  },
  travel: {
    name: 'Zimbabwe Travel Information',
    tagline: 'Discover the Heart of Africa',
    website: 'travel-info.co.zw',
    websiteUrl: 'https://travel-info.co.zw',
    logo: 'https://assets.nyuchi.com/logos/zti/Zimbabwe_Travel_Information_Logo_dark.png',
    socials: {
      twitter: 'https://x.com/zimbabwetravel',
      instagram: 'https://instagram.com/zimbabwe.travel'
    }
  },
  techLeaders: {
    // Renamed from "Technology Leaders of Africa" (techdirectors.africa).
    name: 'TELIA — Technology Leaders in Africa',
    tagline: 'Leading African Innovation',
    website: 'telia.bundu.org',
    websiteUrl: 'https://telia.bundu.org',
    logo: 'https://assets.nyuchi.com/logos/technology-leaders/Technology_Leaders_Logo_dark.png',
    socials: {
      linkedin: 'https://www.linkedin.com/company/technology-leaders-africa/'
    }
  },
  bundu: {
    name: 'Bundu Foundation',
    tagline: 'The wilderness holds the hive',
    website: 'bundu.org',
    websiteUrl: 'https://bundu.org',
    logo: 'https://assets.nyuchi.com/logos/bundu/Bundu_Foundation_Logo_dark.svg', // TODO(brand): confirm logo asset
    socials: {} // TODO(brand): confirm socials
  },
  shamwari: {
    name: 'Shamwari AI',
    tagline: 'AI that actually works for Africa',
    website: 'shamwari.ai',
    websiteUrl: 'https://shamwari.ai',
    logo: 'https://assets.nyuchi.com/logos/shamwari/Shamwari_AI_Logo_dark.svg', // TODO(brand): confirm logo asset
    socials: {} // TODO(brand): confirm socials
  }
};

// Admin config for domain-wide deployment
const ADMIN_CONFIG = {
  domain: 'nyuchi.com',

  // Promotional banner passed to the render API for admin-pushed signatures
  // (the retired inline admin template always included it).
  banner: {
    imageUrl: 'https://drive.google.com/file/d/1QoMdrAUZB7_0Ls12vr6YNo6NfQn74-di/view?usp=sharing',
    linkUrl: 'https://www.nyuchi.com',
    altText: 'Ubuntu - I am because we are'
  },

  // Email domain to division mapping
  divisions: {
    'lingo.nyuchi.com': { brandKey: 'lingo' },
    'learning.nyuchi.com': { brandKey: 'learning' },
    'services.nyuchi.com': { brandKey: 'development' },
    'travel-info.co.zw': { brandKey: 'travel' },
    'mukoko.com': { brandKey: 'mukoko' },
    'hararemetro.co.zw': { brandKey: 'mukokoNews' },
    'news.mukoko.com': { brandKey: 'mukokoNews' },
    'nyuchi.com': { brandKey: 'nyuchi' },
    'foundation.nyuchi.com': { brandKey: 'foundation' },
    'bundu.org': { brandKey: 'bundu' },
    'shamwari.ai': { brandKey: 'shamwari' },
    'telia.bundu.org': { brandKey: 'techLeaders' },
    'techdirectors.africa': { brandKey: 'techLeaders' } // legacy TELIA domain
  }
};

// CardService UI colors only — signature HTML colors live in the engine.
const COLORS = {
  primary: '#5f5873'
};

// ============================================================================
// SIGNATURE RENDER API (tools.nyuchi.com)
// ============================================================================

/**
 * Map this add-on's brand keys onto the render API's brand slugs
 * (BRAND_KEYS in signature-generator/src/engines/signature: nyuchi, bundu,
 * mukoko, shamwari, travel, learning). Divisions/initiatives without their
 * own signature identity in the engine render under their parent brand.
 */
const API_BRAND_SLUGS = {
  nyuchi: 'nyuchi',
  lingo: 'nyuchi',        // Nyuchi Africa division — no engine identity
  learning: 'learning',
  development: 'nyuchi',  // Nyuchi Africa division — no engine identity
  foundation: 'nyuchi',   // Nyuchi Africa division — no engine identity
  mukoko: 'mukoko',
  mukokoNews: 'mukoko',   // Mukoko division — no engine identity
  travel: 'travel',
  techLeaders: 'bundu',   // Bundu Foundation initiative — no engine identity
  bundu: 'bundu',
  shamwari: 'shamwari'
};

/**
 * Resolve an add-on brand key to a render-API brand slug.
 */
function toApiBrandSlug(brandKey) {
  return API_BRAND_SLUGS[brandKey] || 'nyuchi';
}

/**
 * Resolve a render-API brand slug from an email address (domain-keyed,
 * same mapping semantics as getBrandFromEmail).
 */
function getBrandSlugFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'nyuchi';
  }
  const domain = email.split('@')[1];
  const divisionConfig = ADMIN_CONFIG.divisions[domain];
  if (divisionConfig && divisionConfig.brandKey) {
    return toApiBrandSlug(divisionConfig.brandKey);
  }
  return 'nyuchi';
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

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

/**
 * Homepage trigger - shows the tabbed interface
 */
function onHomepage(e) {
  return buildTabbedCard('user');
}

/**
 * Compose trigger - inserts signature into email draft
 */
function onComposeInsert(e) {
  const settings = getUserSettings();

  if (!settings.name || !settings.email) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Please configure your signature first by clicking on the add-on icon.'))
      .build();
  }

  const signatureHtml = generateUserSignatureHtml(settings);

  const response = CardService.newUpdateDraftActionResponseBuilder()
    .setUpdateDraftBodyAction(CardService.newUpdateDraftBodyAction()
      .addUpdateContent(signatureHtml, CardService.ContentType.MUTABLE_HTML)
      .setUpdateType(CardService.UpdateDraftBodyType.INSERT_AT_END))
    .build();

  return response;
}

// ============================================================================
// TABBED CARD BUILDER
// ============================================================================

/**
 * Build the main tabbed card interface
 * @param {string} activeTab - 'user' or 'admin'
 */
function buildTabbedCard(activeTab) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Email Signature Manager')
      .setSubtitle('Nyuchi Africa Brands')
      .setImageUrl('https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_dark.svg')
      .setImageStyle(CardService.ImageStyle.SQUARE));

  // Tab Navigation Section
  const tabSection = CardService.newCardSection();

  const tabButtons = CardService.newButtonSet();

  // User Tab Button
  const userTabButton = CardService.newTextButton()
    .setText(activeTab === 'user' ? '[ User ]' : 'User')
    .setOnClickAction(CardService.newAction().setFunctionName('switchToUserTab'));

  if (activeTab === 'user') {
    userTabButton.setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(COLORS.primary);
  } else {
    userTabButton.setTextButtonStyle(CardService.TextButtonStyle.TEXT);
  }

  // Admin Tab Button
  const adminTabButton = CardService.newTextButton()
    .setText(activeTab === 'admin' ? '[ Admin ]' : 'Admin')
    .setOnClickAction(CardService.newAction().setFunctionName('switchToAdminTab'));

  if (activeTab === 'admin') {
    adminTabButton.setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(COLORS.primary);
  } else {
    adminTabButton.setTextButtonStyle(CardService.TextButtonStyle.TEXT);
  }

  tabButtons.addButton(userTabButton).addButton(adminTabButton);
  tabSection.addWidget(tabButtons);
  tabSection.addWidget(CardService.newDivider());

  card.addSection(tabSection);

  // Add content based on active tab
  if (activeTab === 'user') {
    addUserTabContent(card);
  } else {
    addAdminTabContent(card);
  }

  return card.build();
}

/**
 * Switch to User tab
 */
function switchToUserTab(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .updateCard(buildTabbedCard('user')))
    .build();
}

/**
 * Switch to Admin tab
 */
function switchToAdminTab(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .updateCard(buildTabbedCard('admin')))
    .build();
}

// ============================================================================
// USER TAB CONTENT
// ============================================================================

/**
 * Add User tab content to the card
 */
function addUserTabContent(card) {
  const settings = getUserSettings();
  const userEmail = Session.getActiveUser().getEmail();

  // Brand Selection Section
  const brandSection = CardService.newCardSection()
    .setHeader('Select Your Brand');

  const brandDropdown = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('brand')
    .setTitle('Brand')
    .setOnChangeAction(CardService.newAction().setFunctionName('onBrandChange'));

  // Add brand options grouped by parent
  brandDropdown.addItem('Bundu Foundation', 'bundu', settings.brand === 'bundu');
  brandDropdown.addItem('Nyuchi Africa', 'nyuchi', settings.brand === 'nyuchi');
  brandDropdown.addItem('  - Nyuchi Lingo', 'lingo', settings.brand === 'lingo');
  brandDropdown.addItem('  - Nyuchi Learning', 'learning', settings.brand === 'learning');
  brandDropdown.addItem('  - Nyuchi Development', 'development', settings.brand === 'development');
  brandDropdown.addItem('  - Nyuchi Foundation', 'foundation', settings.brand === 'foundation');
  brandDropdown.addItem('Mukoko', 'mukoko', settings.brand === 'mukoko');
  brandDropdown.addItem('  - Mukoko News', 'mukokoNews', settings.brand === 'mukokoNews');
  brandDropdown.addItem('Shamwari AI', 'shamwari', settings.brand === 'shamwari');
  brandDropdown.addItem('Zimbabwe Travel', 'travel', settings.brand === 'travel');
  brandDropdown.addItem('TELIA — Tech Leaders in Africa', 'techLeaders', settings.brand === 'techLeaders');

  brandSection.addWidget(brandDropdown);
  card.addSection(brandSection);

  // Personal Information Section
  const personalSection = CardService.newCardSection()
    .setHeader('Personal Information');

  personalSection.addWidget(CardService.newTextInput()
    .setFieldName('name')
    .setTitle('Full Name')
    .setValue(settings.name || '')
    .setHint('e.g., Bryan Fawcett'));

  personalSection.addWidget(CardService.newTextInput()
    .setFieldName('title')
    .setTitle('Job Title')
    .setValue(settings.title || '')
    .setHint('e.g., CEO & Founder'));

  personalSection.addWidget(CardService.newTextInput()
    .setFieldName('email')
    .setTitle('Email')
    .setValue(settings.email || userEmail)
    .setHint('e.g., bryan@nyuchi.com'));

  personalSection.addWidget(CardService.newTextInput()
    .setFieldName('phone')
    .setTitle('Phone (optional)')
    .setValue(settings.phone || '')
    .setHint('e.g., +65 9814 3374'));

  personalSection.addWidget(CardService.newTextInput()
    .setFieldName('profileImage')
    .setTitle('Profile Image URL (optional)')
    .setValue(settings.profileImage || '')
    .setHint('https://...'));

  card.addSection(personalSection);

  // Social Links Section
  const socialSection = CardService.newCardSection()
    .setHeader('Social Links (optional)')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  socialSection.addWidget(CardService.newTextInput()
    .setFieldName('linkedin')
    .setTitle('LinkedIn')
    .setValue(settings.linkedin || '')
    .setHint('https://linkedin.com/in/...'));

  socialSection.addWidget(CardService.newTextInput()
    .setFieldName('twitter')
    .setTitle('X / Twitter')
    .setValue(settings.twitter || '')
    .setHint('https://x.com/...'));

  socialSection.addWidget(CardService.newTextInput()
    .setFieldName('facebook')
    .setTitle('Facebook')
    .setValue(settings.facebook || '')
    .setHint('https://facebook.com/...'));

  socialSection.addWidget(CardService.newTextInput()
    .setFieldName('instagram')
    .setTitle('Instagram')
    .setValue(settings.instagram || '')
    .setHint('https://instagram.com/...'));

  socialSection.addWidget(CardService.newTextInput()
    .setFieldName('whatsapp')
    .setTitle('WhatsApp Number')
    .setValue(settings.whatsapp || '')
    .setHint('263771234567 (no + sign)'));

  card.addSection(socialSection);

  // Promo Banner Section
  const promoSection = CardService.newCardSection()
    .setHeader('Promotional Banner (optional)')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  promoSection.addWidget(CardService.newTextInput()
    .setFieldName('promoBanner')
    .setTitle('Banner Image URL')
    .setValue(settings.promoBanner || '')
    .setHint('https://...'));

  promoSection.addWidget(CardService.newTextInput()
    .setFieldName('promoLink')
    .setTitle('Banner Link URL')
    .setValue(settings.promoLink || '')
    .setHint('https://...'));

  card.addSection(promoSection);

  // Actions Section
  const actionSection = CardService.newCardSection();

  actionSection.addWidget(CardService.newTextButton()
    .setText('Save & Preview Signature')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(COLORS.primary)
    .setOnClickAction(CardService.newAction().setFunctionName('saveAndPreview')));

  actionSection.addWidget(CardService.newTextButton()
    .setText('Apply to Gmail')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#1a73e8')
    .setOnClickAction(CardService.newAction().setFunctionName('applyToGmail')));

  card.addSection(actionSection);
}

// ============================================================================
// ADMIN TAB CONTENT
// ============================================================================

/**
 * Add Admin tab content to the card
 */
function addAdminTabContent(card) {
  // Admin Info Section
  const infoSection = CardService.newCardSection()
    .setHeader('Admin Signature Deployment');

  infoSection.addWidget(CardService.newTextParagraph()
    .setText('Push branded email signatures to all users in your Google Workspace domain. Signatures are automatically generated based on each user\'s email domain.'));

  infoSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Domain')
    .setText(ADMIN_CONFIG.domain));

  // Open Full Dashboard Button
  infoSection.addWidget(CardService.newTextButton()
    .setText('Open Full Dashboard')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(COLORS.primary)
    .setOnClickAction(CardService.newAction().setFunctionName('openDashboard')));

  card.addSection(infoSection);

  // Single User Section
  const singleUserSection = CardService.newCardSection()
    .setHeader('Update Single User');

  singleUserSection.addWidget(CardService.newTextInput()
    .setFieldName('targetEmail')
    .setTitle('User Email')
    .setHint('e.g., user@nyuchi.com'));

  singleUserSection.addWidget(CardService.newTextButton()
    .setText('Preview Signature')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('adminPreviewSignature')));

  singleUserSection.addWidget(CardService.newTextButton()
    .setText('Update This User')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#1a73e8')
    .setOnClickAction(CardService.newAction().setFunctionName('adminUpdateSingleUser')));

  card.addSection(singleUserSection);

  // Bulk Actions Section
  const bulkSection = CardService.newCardSection()
    .setHeader('Bulk Operations');

  bulkSection.addWidget(CardService.newTextButton()
    .setText('List All Users & Aliases')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('adminListAllUsers')));

  bulkSection.addWidget(CardService.newTextButton()
    .setText('Update ALL User Signatures')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#d93025')
    .setOnClickAction(CardService.newAction().setFunctionName('adminUpdateAllUsers')));

  bulkSection.addWidget(CardService.newTextParagraph()
    .setText('⚠️ This will update signatures for all users and their email aliases in your domain.'));

  card.addSection(bulkSection);

  // Scheduling Section
  const scheduleSection = CardService.newCardSection()
    .setHeader('Scheduled Updates')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  scheduleSection.addWidget(CardService.newTextParagraph()
    .setText('Set up automatic daily signature updates at 2 AM.'));

  scheduleSection.addWidget(CardService.newTextButton()
    .setText('Enable Daily Updates')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(COLORS.primary)
    .setOnClickAction(CardService.newAction().setFunctionName('adminCreateDailyTrigger')));

  scheduleSection.addWidget(CardService.newTextButton()
    .setText('Disable Daily Updates')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('adminRemoveDailyTrigger')));

  card.addSection(scheduleSection);
}

// ============================================================================
// USER TAB ACTION HANDLERS
// ============================================================================

/**
 * Handle brand change
 */
function onBrandChange(e) {
  const brand = e.formInput.brand;
  const settings = getUserSettings();
  settings.brand = brand;

  // Update socials from brand defaults if user hasn't set them
  const brandConfig = BRANDS[brand];
  if (brandConfig && brandConfig.socials) {
    if (!settings.linkedin && brandConfig.socials.linkedin) {
      settings.linkedin = brandConfig.socials.linkedin;
    }
    if (!settings.twitter && brandConfig.socials.twitter) {
      settings.twitter = brandConfig.socials.twitter;
    }
    if (!settings.facebook && brandConfig.socials.facebook) {
      settings.facebook = brandConfig.socials.facebook;
    }
    if (!settings.instagram && brandConfig.socials.instagram) {
      settings.instagram = brandConfig.socials.instagram;
    }
  }

  saveUserSettings(settings);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .updateCard(buildTabbedCard('user')))
    .build();
}

/**
 * Save settings and show preview
 */
function saveAndPreview(e) {
  const formInput = e.formInput;

  const settings = {
    brand: formInput.brand || 'nyuchi',
    name: formInput.name || '',
    title: formInput.title || '',
    email: formInput.email || '',
    phone: formInput.phone || '',
    profileImage: formInput.profileImage || '',
    linkedin: formInput.linkedin || '',
    twitter: formInput.twitter || '',
    facebook: formInput.facebook || '',
    instagram: formInput.instagram || '',
    whatsapp: formInput.whatsapp || '',
    promoBanner: formInput.promoBanner || '',
    promoLink: formInput.promoLink || ''
  };

  // Validate required fields
  if (!settings.name || !settings.email) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Please fill in your name and email address.'))
      .build();
  }

  saveUserSettings(settings);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .pushCard(buildPreviewCard(settings)))
    .build();
}

/**
 * Apply signature to Gmail
 */
function applyToGmail(e) {
  // First save any form input
  if (e.formInput) {
    const formInput = e.formInput;
    const settings = {
      brand: formInput.brand || 'nyuchi',
      name: formInput.name || '',
      title: formInput.title || '',
      email: formInput.email || '',
      phone: formInput.phone || '',
      profileImage: formInput.profileImage || '',
      linkedin: formInput.linkedin || '',
      twitter: formInput.twitter || '',
      facebook: formInput.facebook || '',
      instagram: formInput.instagram || '',
      whatsapp: formInput.whatsapp || '',
      promoBanner: formInput.promoBanner || '',
      promoLink: formInput.promoLink || ''
    };
    saveUserSettings(settings);
  }

  const settings = getUserSettings();

  // Validate required fields
  if (!settings.name || !settings.email) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Please fill in your name and email address first.'))
      .build();
  }

  try {
    const signatureHtml = generateUserSignatureHtml(settings);
    const userEmail = Session.getActiveUser().getEmail();

    // Apply signature using Gmail API
    Gmail.Users.Settings.SendAs.update(
      { signature: signatureHtml },
      'me',
      userEmail
    );

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .pushCard(buildSuccessCard()))
      .setNotification(CardService.newNotification()
        .setText('Signature applied successfully!'))
      .build();

  } catch (error) {
    Logger.log('Error applying signature: ' + error.message);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error applying signature: ' + error.message))
      .build();
  }
}

/**
 * Navigate back to main card
 */
function backToMain(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .popToRoot()
      .updateCard(buildTabbedCard('user')))
    .build();
}

/**
 * Reset all settings
 */
function resetSettings(e) {
  PropertiesService.getUserProperties().deleteAllProperties();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .updateCard(buildTabbedCard('user')))
    .setNotification(CardService.newNotification()
      .setText('Settings have been reset.'))
    .build();
}

// ============================================================================
// ADMIN TAB ACTION HANDLERS
// ============================================================================

/**
 * Preview signature for a specific user (Admin)
 */
function adminPreviewSignature(e) {
  const targetEmail = e.formInput.targetEmail;

  if (!targetEmail) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Please enter a user email address.'))
      .build();
  }

  try {
    const user = AdminDirectory.Users.get(targetEmail, { projection: 'full' });
    const signature = generateAdminSignatureHtml(user, targetEmail);

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .pushCard(buildAdminPreviewCard(user, targetEmail, signature)))
      .build();

  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + error.message))
      .build();
  }
}

/**
 * Update signature for a single user (Admin)
 */
function adminUpdateSingleUser(e) {
  const targetEmail = e.formInput.targetEmail;

  if (!targetEmail) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Please enter a user email address.'))
      .build();
  }

  try {
    const user = AdminDirectory.Users.get(targetEmail, { projection: 'full' });
    const aliases = getAdminUserAliases(user);
    const allAddresses = [user.primaryEmail, ...aliases];
    let updatedCount = 0;

    allAddresses.forEach(emailAddress => {
      const signature = generateAdminSignatureHtml(user, emailAddress);
      Gmail.Users.Settings.SendAs.update(
        { signature: signature },
        user.primaryEmail,
        emailAddress
      );
      updatedCount++;
    });

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText(`Updated ${updatedCount} email address(es) for ${user.name.fullName}`))
      .build();

  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + error.message))
      .build();
  }
}

/**
 * List all users and their aliases (Admin)
 */
function adminListAllUsers(e) {
  try {
    const users = getAllDomainUsers();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .pushCard(buildUserListCard(users)))
      .build();

  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + error.message))
      .build();
  }
}

/**
 * Update all user signatures (Admin)
 */
function adminUpdateAllUsers(e) {
  try {
    const users = getAllDomainUsers();
    let successCount = 0;
    let failedCount = 0;

    users.forEach(user => {
      const aliases = getAdminUserAliases(user);
      const allAddresses = [user.primaryEmail, ...aliases];

      allAddresses.forEach(emailAddress => {
        try {
          const signature = generateAdminSignatureHtml(user, emailAddress);
          Gmail.Users.Settings.SendAs.update(
            { signature: signature },
            user.primaryEmail,
            emailAddress
          );
          successCount++;
        } catch (err) {
          failedCount++;
          Logger.log(`Failed for ${emailAddress}: ${err.message}`);
        }
        Utilities.sleep(300); // Rate limiting
      });
      Utilities.sleep(300);
    });

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .pushCard(buildBulkResultCard(successCount, failedCount)))
      .setNotification(CardService.newNotification()
        .setText(`Updated ${successCount} signatures, ${failedCount} failed`))
      .build();

  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + error.message))
      .build();
  }
}

/**
 * Create daily trigger for automatic updates (Admin)
 */
function adminCreateDailyTrigger(e) {
  try {
    // Remove existing triggers first
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'scheduledSignatureUpdate') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Create new trigger
    ScriptApp.newTrigger('scheduledSignatureUpdate')
      .timeBased()
      .atHour(2)
      .everyDays(1)
      .create();

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Daily trigger created - signatures will update at 2 AM'))
      .build();

  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error creating trigger: ' + error.message))
      .build();
  }
}

/**
 * Remove daily trigger (Admin)
 */
function adminRemoveDailyTrigger(e) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'scheduledSignatureUpdate') {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      }
    });

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText(removed > 0 ? 'Daily trigger removed' : 'No active triggers found'))
      .build();

  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error removing trigger: ' + error.message))
      .build();
  }
}

/**
 * Scheduled function called by trigger
 */
function scheduledSignatureUpdate() {
  const users = getAllDomainUsers();

  users.forEach(user => {
    const aliases = getAdminUserAliases(user);
    const allAddresses = [user.primaryEmail, ...aliases];

    allAddresses.forEach(emailAddress => {
      try {
        const signature = generateAdminSignatureHtml(user, emailAddress);
        Gmail.Users.Settings.SendAs.update(
          { signature: signature },
          user.primaryEmail,
          emailAddress
        );
        Logger.log(`Updated: ${emailAddress}`);
      } catch (err) {
        Logger.log(`Failed: ${emailAddress} - ${err.message}`);
      }
      Utilities.sleep(300);
    });
    Utilities.sleep(300);
  });
}

// ============================================================================
// ADMIN CARD BUILDERS
// ============================================================================

/**
 * Build admin preview card
 */
function buildAdminPreviewCard(user, emailAddress, signatureHtml) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Signature Preview')
      .setSubtitle(emailAddress));

  const infoSection = CardService.newCardSection();

  infoSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Name')
    .setText(user.name.fullName));

  const title = getJobTitle(user);
  if (title) {
    infoSection.addWidget(CardService.newDecoratedText()
      .setTopLabel('Title')
      .setText(title));
  }

  const phone = getPhoneNumber(user);
  if (phone) {
    infoSection.addWidget(CardService.newDecoratedText()
      .setTopLabel('Phone')
      .setText(phone));
  }

  const brand = getBrandFromEmail(emailAddress);
  infoSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Brand')
    .setText(brand.name));

  const aliases = getAdminUserAliases(user);
  if (aliases.length > 0) {
    infoSection.addWidget(CardService.newDecoratedText()
      .setTopLabel('Other Aliases')
      .setText(aliases.join(', ')));
  }

  card.addSection(infoSection);

  // Actions
  const actionSection = CardService.newCardSection();

  actionSection.addWidget(CardService.newTextButton()
    .setText('Apply This Signature')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#1a73e8')
    .setOnClickAction(CardService.newAction()
      .setFunctionName('adminApplyPreviewedSignature')
      .setParameters({ email: emailAddress })));

  actionSection.addWidget(CardService.newTextButton()
    .setText('Back')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('backToAdminTab')));

  card.addSection(actionSection);

  return card.build();
}

/**
 * Build user list card
 */
function buildUserListCard(users) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Domain Users')
      .setSubtitle(`${users.length} users found`));

  // Group users into sections (max 10 per section for card limits)
  const chunkSize = 10;
  for (let i = 0; i < Math.min(users.length, 50); i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const section = CardService.newCardSection()
      .setHeader(`Users ${i + 1}-${Math.min(i + chunkSize, users.length)}`);

    chunk.forEach(user => {
      const aliases = getAdminUserAliases(user);
      const aliasText = aliases.length > 0 ? ` (+${aliases.length} aliases)` : '';

      section.addWidget(CardService.newDecoratedText()
        .setTopLabel(user.name.fullName)
        .setText(user.primaryEmail + aliasText));
    });

    card.addSection(section);
  }

  if (users.length > 50) {
    const moreSection = CardService.newCardSection();
    moreSection.addWidget(CardService.newTextParagraph()
      .setText(`...and ${users.length - 50} more users. View full list in the script logs.`));
    card.addSection(moreSection);
  }

  // Back button
  const actionSection = CardService.newCardSection();
  actionSection.addWidget(CardService.newTextButton()
    .setText('Back')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('backToAdminTab')));
  card.addSection(actionSection);

  return card.build();
}

/**
 * Build bulk operation result card
 */
function buildBulkResultCard(successCount, failedCount) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Bulk Update Complete')
      .setSubtitle('Signature deployment finished'));

  const section = CardService.newCardSection();

  section.addWidget(CardService.newDecoratedText()
    .setTopLabel('Successful')
    .setText(`${successCount} signatures updated`));

  section.addWidget(CardService.newDecoratedText()
    .setTopLabel('Failed')
    .setText(`${failedCount} signatures failed`));

  if (failedCount > 0) {
    section.addWidget(CardService.newTextParagraph()
      .setText('Check the script execution logs for details on failed updates.'));
  }

  card.addSection(section);

  // Back button
  const actionSection = CardService.newCardSection();
  actionSection.addWidget(CardService.newTextButton()
    .setText('Back to Admin')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('backToAdminTab')));
  card.addSection(actionSection);

  return card.build();
}

/**
 * Apply signature from preview (Admin)
 */
function adminApplyPreviewedSignature(e) {
  const emailAddress = e.parameters.email;

  try {
    const user = AdminDirectory.Users.get(emailAddress, { projection: 'full' });
    const signature = generateAdminSignatureHtml(user, emailAddress);

    Gmail.Users.Settings.SendAs.update(
      { signature: signature },
      user.primaryEmail,
      emailAddress
    );

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText(`Signature applied to ${emailAddress}`))
      .build();

  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + error.message))
      .build();
  }
}

/**
 * Navigate back to admin tab
 */
function backToAdminTab(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .popToRoot()
      .updateCard(buildTabbedCard('admin')))
    .build();
}

// ============================================================================
// USER TAB CARD BUILDERS
// ============================================================================

/**
 * Build the signature preview card (User)
 */
function buildPreviewCard(settings) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Signature Preview')
      .setSubtitle('Review your signature'));

  const previewSection = CardService.newCardSection();

  const brand = BRANDS[settings.brand] || BRANDS.nyuchi;

  previewSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Name')
    .setText(settings.name || 'Not set'));

  previewSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Title')
    .setText(settings.title || 'Not set'));

  previewSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Email')
    .setText(settings.email || 'Not set'));

  if (settings.phone) {
    previewSection.addWidget(CardService.newDecoratedText()
      .setTopLabel('Phone')
      .setText(settings.phone));
  }

  previewSection.addWidget(CardService.newDivider());

  previewSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Brand')
    .setText(brand.name));

  previewSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Tagline')
    .setText(brand.tagline));

  previewSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Website')
    .setText(brand.website));

  if (brand.parent) {
    previewSection.addWidget(CardService.newDecoratedText()
      .setTopLabel('Parent Company')
      .setText(brand.parent));
  }

  card.addSection(previewSection);

  // Social Links Preview
  const socials = [];
  if (settings.linkedin) socials.push('LinkedIn');
  if (settings.twitter) socials.push('X/Twitter');
  if (settings.facebook) socials.push('Facebook');
  if (settings.instagram) socials.push('Instagram');
  if (settings.whatsapp) socials.push('WhatsApp');

  if (socials.length > 0) {
    const socialSection = CardService.newCardSection()
      .setHeader('Social Links');

    socialSection.addWidget(CardService.newDecoratedText()
      .setText(socials.join(' | ')));

    card.addSection(socialSection);
  }

  // Actions
  const actionSection = CardService.newCardSection();

  actionSection.addWidget(CardService.newTextButton()
    .setText('Apply to Gmail')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#1a73e8')
    .setOnClickAction(CardService.newAction().setFunctionName('applyToGmail')));

  actionSection.addWidget(CardService.newTextButton()
    .setText('Back to Edit')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('backToMain')));

  card.addSection(actionSection);

  return card.build();
}

/**
 * Build success card after applying signature (User)
 */
function buildSuccessCard() {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Success!')
      .setSubtitle('Your signature has been applied'));

  const section = CardService.newCardSection();

  section.addWidget(CardService.newTextParagraph()
    .setText('Your new email signature has been applied to Gmail. It will appear in all new emails you compose.'));

  section.addWidget(CardService.newTextParagraph()
    .setText('To test it, compose a new email and you should see your signature at the bottom.'));

  section.addWidget(CardService.newDivider());

  section.addWidget(CardService.newTextButton()
    .setText('Edit Signature')
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(CardService.newAction().setFunctionName('backToMain')));

  card.addSection(section);

  return card.build();
}

// ============================================================================
// SIGNATURE GENERATION - USER TAB
// ============================================================================

/**
 * Generate the HTML signature for user self-service.
 *
 * Thin wrapper over the Worker render API — maps the saved user settings
 * onto the API params and returns the canonical engine HTML. The name is
 * kept (referenced from onComposeInsert / applyToGmail); the inline template
 * it used to contain is gone.
 */
function generateUserSignatureHtml(settings) {
  return fetchSignatureHtml({
    brand: toApiBrandSlug(settings.brand),
    name: settings.name || '',
    email: settings.email || '',
    title: settings.title || '',
    phone: settings.phone || '',
    whatsapp: settings.whatsapp || '',
    profileImage: settings.profileImage || '',
    linkedin: settings.linkedin || '',
    twitter: settings.twitter || '',
    facebook: settings.facebook || '',
    instagram: settings.instagram || '',
    promoBanner: settings.promoBanner || '',
    promoLink: settings.promoLink || ''
  });
}

// ============================================================================
// SIGNATURE GENERATION - ADMIN TAB
// ============================================================================

/**
 * Get brand config from email domain
 */
function getBrandFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return BRANDS.nyuchi;
  }
  const domain = email.split('@')[1];
  const divisionConfig = ADMIN_CONFIG.divisions[domain];

  if (divisionConfig && divisionConfig.brandKey) {
    return BRANDS[divisionConfig.brandKey] || BRANDS.nyuchi;
  }
  return BRANDS.nyuchi;
}

/**
 * Generate the HTML signature for admin deployment.
 *
 * Thin wrapper over the Worker render API — derives the same fields the old
 * inline admin template used (directory name/title/phone, brand from the
 * email domain, the ADMIN_CONFIG promo banner) and returns the canonical
 * engine HTML. The name is kept (referenced by the admin handlers and the
 * Dashboard server functions); the inline template it used to contain is gone.
 */
function generateAdminSignatureHtml(user, emailAddress) {
  if (!user) {
    throw new Error('User object is required to generate an admin signature');
  }

  const name = (user.name && user.name.fullName) ? user.name.fullName : (user.primaryEmail ? user.primaryEmail.split('@')[0] : 'User');
  const title = getJobTitle(user);
  const phone = getPhoneNumber(user);
  const email = emailAddress || (user.primaryEmail || 'email@nyuchi.com');

  return fetchSignatureHtml({
    brand: getBrandSlugFromEmail(email),
    name: name,
    email: email,
    title: title || '',
    phone: phone || '',
    promoBanner: ADMIN_CONFIG.banner.imageUrl,
    promoLink: ADMIN_CONFIG.banner.linkUrl
  });
}

// ============================================================================
// GOOGLE WORKSPACE API FUNCTIONS (ADMIN)
// ============================================================================

/**
 * Get all users in the domain
 */
function getAllDomainUsers() {
  const users = [];
  let pageToken = null;

  do {
    const response = AdminDirectory.Users.list({
      domain: ADMIN_CONFIG.domain,
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

  Logger.log(`Found ${users.length} users`);
  return users;
}

/**
 * Get all email aliases for a user (Admin)
 */
function getAdminUserAliases(user) {
  if (!user) {
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract job title from user object
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
// STORAGE HELPERS
// ============================================================================

/**
 * Get user settings from Properties Service
 */
function getUserSettings() {
  const props = PropertiesService.getUserProperties();
  const settingsJson = props.getProperty('signatureSettings');

  if (settingsJson) {
    try {
      return JSON.parse(settingsJson);
    } catch (e) {
      Logger.log('Error parsing settings: ' + e.message);
    }
  }

  // Return default settings
  return {
    brand: 'nyuchi',
    name: '',
    title: '',
    email: Session.getActiveUser().getEmail() || '',
    phone: '',
    profileImage: '',
    linkedin: '',
    twitter: '',
    facebook: '',
    instagram: '',
    whatsapp: '',
    promoBanner: '',
    promoLink: ''
  };
}

/**
 * Save user settings to Properties Service
 */
function saveUserSettings(settings) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('signatureSettings', JSON.stringify(settings));
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================
// Run manually from the Apps Script editor. Both tests call the live render
// API, so SIGNATURE_API_KEY must be set in Script Properties (and
// SIGNATURE_API_URL if not using the default https://tools.nyuchi.com).

/**
 * Test signature generation with sample data (calls the render API)
 */
function testSignatureGeneration() {
  const testSettings = {
    brand: 'nyuchi',
    name: 'Bryan Fawcett',
    title: 'CEO & Founder',
    email: 'bryan@nyuchi.com',
    phone: '+65 9814 3374',
    profileImage: '',
    linkedin: 'https://www.linkedin.com/company/nyuchi/',
    twitter: '',
    facebook: 'https://facebook.com/nyuchigroup',
    instagram: 'https://instagram.com/nyuchi.africa',
    whatsapp: '6598143374',
    promoBanner: '',
    promoLink: ''
  };

  try {
    const html = generateUserSignatureHtml(testSettings);
    Logger.log('Generated Signature HTML (from render API):');
    Logger.log(html);

    const checks = {
      'User name': html.indexOf('Bryan Fawcett') !== -1,
      'Email address': html.indexOf('bryan@nyuchi.com') !== -1,
      'Brand name': html.indexOf('Nyuchi Africa') !== -1,
      'Phone number': html.indexOf('+65 9814 3374') !== -1
    };
    let allPassed = true;
    Object.keys(checks).forEach(function (check) {
      Logger.log((checks[check] ? '✓' : '✗') + ' ' + check);
      if (!checks[check]) allPassed = false;
    });
    Logger.log(allPassed ? 'PASS: testSignatureGeneration' : 'FAIL: testSignatureGeneration — see checks above');
    return html;
  } catch (error) {
    Logger.log('FAIL: testSignatureGeneration — ' + error.message);
    Logger.log('Note: this test requires SIGNATURE_API_KEY in Script Properties.');
    throw error;
  }
}

/**
 * Test admin signature generation (calls the render API)
 */
function testAdminSignature() {
  const mockUser = {
    name: { fullName: 'Test User' },
    primaryEmail: 'test@lingo.nyuchi.com',
    organizations: [{ title: 'Software Engineer', primary: true }],
    phones: [{ value: '+263 77 123 4567', type: 'work' }]
  };

  try {
    const html = generateAdminSignatureHtml(mockUser, 'test@lingo.nyuchi.com');
    Logger.log('Generated Admin Signature HTML (from render API):');
    Logger.log(html);

    // lingo.nyuchi.com renders under the parent nyuchi brand slug.
    const expectedPhone = getPhoneNumber(mockUser);
    const checks = {
      'User name': html.indexOf('Test User') !== -1,
      'Email address': html.indexOf('test@lingo.nyuchi.com') !== -1,
      'Brand name (parent Nyuchi Africa)': html.indexOf('Nyuchi Africa') !== -1,
      'Phone number': html.indexOf(expectedPhone) !== -1
    };
    let allPassed = true;
    Object.keys(checks).forEach(function (check) {
      Logger.log((checks[check] ? '✓' : '✗') + ' ' + check);
      if (!checks[check]) allPassed = false;
    });
    Logger.log(allPassed ? 'PASS: testAdminSignature' : 'FAIL: testAdminSignature — see checks above');
    return html;
  } catch (error) {
    Logger.log('FAIL: testAdminSignature — ' + error.message);
    Logger.log('Note: this test requires SIGNATURE_API_KEY in Script Properties.');
    throw error;
  }
}

// ============================================================================
// DASHBOARD WEB APP FUNCTIONS
// ============================================================================

/**
 * Open the dashboard as a web app
 * Can be accessed via: https://script.google.com/macros/s/{deployment-id}/exec
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Nyuchi Email Signature Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Open dashboard from add-on (as sidebar or modal)
 */
function openDashboard(e) {
  const html = HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Nyuchi Signature Manager')
    .setWidth(1200)
    .setHeight(800);

  // Return a link to open the web app
  const url = ScriptApp.getService().getUrl();

  return CardService.newActionResponseBuilder()
    .setOpenLink(CardService.newOpenLink()
      .setUrl(url)
      .setOpenAs(CardService.OpenAs.FULL_SIZE)
      .setOnClose(CardService.OnClose.NOTHING))
    .build();
}

/**
 * Get current user info for dashboard
 */
function getCurrentUserInfo() {
  const email = Session.getActiveUser().getEmail();
  let name = email.split('@')[0];

  try {
    const user = AdminDirectory.Users.get(email);
    if (user.name && user.name.fullName) {
      name = user.name.fullName;
    }
  } catch (e) {
    // Fall back to email-based name
  }

  return {
    email: email,
    name: name
  };
}

/**
 * Get all dashboard data (users, stats, etc.)
 */
function getDashboardData() {
  try {
    const users = getAllDomainUsers();
    let totalAliases = 0;

    const userList = users.map(user => {
      const aliases = getAdminUserAliases(user);
      totalAliases += aliases.length;

      return {
        primaryEmail: user.primaryEmail,
        name: user.name ? user.name.fullName : user.primaryEmail.split('@')[0],
        title: getJobTitle(user),
        phone: getPhoneNumber(user),
        aliases: aliases
      };
    });

    return {
      users: userList,
      totalUsers: users.length,
      totalAliases: totalAliases,
      domain: ADMIN_CONFIG.domain
    };
  } catch (error) {
    Logger.log('Error getting dashboard data: ' + error.message);
    throw new Error('Failed to load users. Make sure you have admin permissions.');
  }
}

/**
 * Get signature preview for a brand (for template preview)
 */
function getSignaturePreview(brandKey) {
  const brand = BRANDS[brandKey] || BRANDS.nyuchi;

  const mockUser = {
    name: { fullName: 'John Doe' },
    primaryEmail: 'john@' + brand.website,
    organizations: [{ title: 'Team Member', primary: true }],
    phones: [{ value: '+263 77 123 4567', type: 'work' }]
  };

  return generateAdminSignatureHtml(mockUser, mockUser.primaryEmail);
}

/**
 * Get signature preview for a specific user
 */
function getUserSignaturePreview(email) {
  try {
    const user = AdminDirectory.Users.get(email, { projection: 'full' });
    const signatureHtml = generateAdminSignatureHtml(user, email);

    return {
      name: user.name ? user.name.fullName : email.split('@')[0],
      email: email,
      signatureHtml: signatureHtml
    };
  } catch (error) {
    throw new Error('Could not find user: ' + email);
  }
}

/**
 * Update a single user's signature from dashboard
 */
function updateSingleUserFromDashboard(email) {
  try {
    const user = AdminDirectory.Users.get(email, { projection: 'full' });
    const aliases = getAdminUserAliases(user);
    const allAddresses = [user.primaryEmail, ...aliases];
    let updatedCount = 0;

    allAddresses.forEach(emailAddress => {
      const signature = generateAdminSignatureHtml(user, emailAddress);
      Gmail.Users.Settings.SendAs.update(
        { signature: signature },
        user.primaryEmail,
        emailAddress
      );
      updatedCount++;
    });

    return {
      success: true,
      updated: updatedCount,
      user: user.name ? user.name.fullName : email
    };
  } catch (error) {
    throw new Error('Failed to update signature: ' + error.message);
  }
}

/**
 * Update all user signatures from dashboard
 */
function updateAllFromDashboard() {
  try {
    const users = getAllDomainUsers();
    let successCount = 0;
    let failedCount = 0;

    users.forEach(user => {
      const aliases = getAdminUserAliases(user);
      const allAddresses = [user.primaryEmail, ...aliases];

      allAddresses.forEach(emailAddress => {
        try {
          const signature = generateAdminSignatureHtml(user, emailAddress);
          Gmail.Users.Settings.SendAs.update(
            { signature: signature },
            user.primaryEmail,
            emailAddress
          );
          successCount++;
        } catch (err) {
          failedCount++;
          Logger.log('Failed for ' + emailAddress + ': ' + err.message);
        }
        Utilities.sleep(300);
      });
      Utilities.sleep(300);
    });

    return {
      success: successCount,
      failed: failedCount,
      total: successCount + failedCount
    };
  } catch (error) {
    throw new Error('Bulk update failed: ' + error.message);
  }
}

/**
 * Create daily trigger from dashboard
 */
function createDailyTriggerFromDashboard() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'scheduledSignatureUpdate') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp.newTrigger('scheduledSignatureUpdate')
      .timeBased()
      .atHour(2)
      .everyDays(1)
      .create();

    return { success: true, message: 'Daily trigger created' };
  } catch (error) {
    throw new Error('Failed to create trigger: ' + error.message);
  }
}

/**
 * Remove daily trigger from dashboard
 */
function removeDailyTriggerFromDashboard() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'scheduledSignatureUpdate') {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      }
    });

    return { success: true, removed: removed };
  } catch (error) {
    throw new Error('Failed to remove trigger: ' + error.message);
  }
}
