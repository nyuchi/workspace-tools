/**
 * Nyuchi Email Signature Generator - Gmail Add-on
 *
 * Combined self-service and admin email signature generator for Nyuchi Africa brands.
 *
 * TWO TABS:
 * - User Tab: Individual users generate and apply their own signatures
 * - Admin Tab: Admins push signatures to all domain users
 *
 * Supported Brands:
 * - Nyuchi Africa (and divisions: Lingo, Learning, Development, Foundation)
 * - Mukoko (and Mukoko News, Mukoko ID)
 * - Zimbabwe Travel Information
 * - Technology Leaders of Africa
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
    name: 'Technology Leaders of Africa',
    tagline: 'Leading African Innovation',
    website: 'techdirectors.africa',
    websiteUrl: 'https://techdirectors.africa',
    logo: 'https://assets.nyuchi.com/logos/technology-leaders/Technology_Leaders_Logo_dark.png',
    socials: {
      linkedin: 'https://www.linkedin.com/company/technology-leaders-africa/'
    }
  }
};

// Admin config for domain-wide deployment
const ADMIN_CONFIG = {
  domain: 'nyuchi.com',
  companyName: 'Nyuchi Africa',
  tagline: 'I am because we are',
  ubuntuFooter: '🇿🇼 Built with Ubuntu • Powered by Community',

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
    'techdirectors.africa': { brandKey: 'techLeaders' }
  }
};

const COLORS = {
  primary: '#5f5873',
  text: '#2a2a2a',
  muted: '#737373',
  flagGreen: '#729b63',
  flagYellow: '#f6ad55',
  flagRed: '#d4634a',
  flagBlack: '#171717',
  flagWhite: '#ffffff'
};

// Social media icon URLs
const SOCIAL_ICONS = {
  linkedin: 'https://cdn-icons-png.flaticon.com/512/3536/3536505.png',
  twitter: 'https://cdn-icons-png.flaticon.com/512/5969/5969020.png',
  facebook: 'https://cdn-icons-png.flaticon.com/512/5968/5968764.png',
  instagram: 'https://cdn-icons-png.flaticon.com/512/2111/2111463.png',
  whatsapp: 'https://cdn-icons-png.flaticon.com/512/3670/3670051.png'
};

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
  brandDropdown.addItem('Nyuchi Africa', 'nyuchi', settings.brand === 'nyuchi');
  brandDropdown.addItem('  - Nyuchi Lingo', 'lingo', settings.brand === 'lingo');
  brandDropdown.addItem('  - Nyuchi Learning', 'learning', settings.brand === 'learning');
  brandDropdown.addItem('  - Nyuchi Development', 'development', settings.brand === 'development');
  brandDropdown.addItem('  - Nyuchi Foundation', 'foundation', settings.brand === 'foundation');
  brandDropdown.addItem('Mukoko', 'mukoko', settings.brand === 'mukoko');
  brandDropdown.addItem('  - Mukoko News', 'mukokoNews', settings.brand === 'mukokoNews');
  brandDropdown.addItem('Zimbabwe Travel', 'travel', settings.brand === 'travel');
  brandDropdown.addItem('Tech Leaders of Africa', 'techLeaders', settings.brand === 'techLeaders');

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
 * Generate the HTML signature for user self-service
 */
function generateUserSignatureHtml(settings) {
  const brand = BRANDS[settings.brand] || BRANDS.nyuchi;

  // Build social icons HTML
  let socialIconsHtml = '';
  const socialLinks = [];

  if (settings.linkedin) {
    socialLinks.push(`<td style="padding-right: 8px;"><a href="${escapeHtml(settings.linkedin)}" style="text-decoration: none;"><img src="${SOCIAL_ICONS.linkedin}" alt="LinkedIn" width="24" height="24" style="display: block; border-radius: 4px;"></a></td>`);
  }
  if (settings.twitter) {
    socialLinks.push(`<td style="padding-right: 8px;"><a href="${escapeHtml(settings.twitter)}" style="text-decoration: none;"><img src="${SOCIAL_ICONS.twitter}" alt="X" width="24" height="24" style="display: block; border-radius: 4px;"></a></td>`);
  }
  if (settings.facebook) {
    socialLinks.push(`<td style="padding-right: 8px;"><a href="${escapeHtml(settings.facebook)}" style="text-decoration: none;"><img src="${SOCIAL_ICONS.facebook}" alt="Facebook" width="24" height="24" style="display: block; border-radius: 4px;"></a></td>`);
  }
  if (settings.instagram) {
    socialLinks.push(`<td style="padding-right: 8px;"><a href="${escapeHtml(settings.instagram)}" style="text-decoration: none;"><img src="${SOCIAL_ICONS.instagram}" alt="Instagram" width="24" height="24" style="display: block; border-radius: 4px;"></a></td>`);
  }
  if (settings.whatsapp) {
    const waLink = `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`;
    socialLinks.push(`<td style="padding-right: 8px;"><a href="${waLink}" style="text-decoration: none;"><img src="${SOCIAL_ICONS.whatsapp}" alt="WhatsApp" width="24" height="24" style="display: block; border-radius: 4px;"></a></td>`);
  }

  if (socialLinks.length > 0) {
    socialIconsHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 12px;">
        <tbody>
          <tr>${socialLinks.join('')}</tr>
        </tbody>
      </table>`;
  }

  // Profile image HTML
  let profileImageHtml = '';
  if (settings.profileImage) {
    profileImageHtml = `
      <td style="vertical-align: top; padding-right: 16px;">
        <img src="${escapeHtml(settings.profileImage)}" alt="Profile" width="80" height="80" style="border-radius: 50%; display: block;">
      </td>`;
  }

  // Phone HTML
  let phoneHtml = '';
  if (settings.phone) {
    const phoneClean = settings.phone.replace(/\s/g, '');
    phoneHtml = `
      <tr>
        <td style="padding-bottom: 3px;">
          <a href="tel:${phoneClean}" style="color: ${COLORS.primary}; text-decoration: none;">${escapeHtml(settings.phone)}</a>
        </td>
      </tr>`;
  }

  // Parent company attribution
  let parentHtml = '';
  if (brand.parent) {
    parentHtml = `
      <tr>
        <td style="padding-top: 8px;">
          <span style="font-size: 11px; color: ${COLORS.muted};">A division of ${brand.parent}</span>
        </td>
      </tr>`;
  }

  // Promo banner HTML
  let promoBannerHtml = '';
  if (settings.promoBanner) {
    const promoLink = settings.promoLink || '#';
    promoBannerHtml = `
      <tr>
        <td colspan="2" style="padding-top: 16px;">
          <a href="${escapeHtml(promoLink)}" style="text-decoration: none;">
            <img src="${escapeHtml(settings.promoBanner)}" alt="Promotion" width="400" style="display: block; max-width: 100%; height: auto; border-radius: 8px;">
          </a>
        </td>
      </tr>`;
  }

  // Generate the signature HTML
  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: ${COLORS.text}; max-width: 500px;">
  <tbody>
    <tr>
      ${profileImageHtml}
      <td style="vertical-align: top;">
        <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 17px; font-weight: 700; color: ${COLORS.text};">
          ${escapeHtml(settings.name)}
        </span>
        <br>
        <span style="font-size: 13px; font-weight: 500; color: ${COLORS.muted};">
          ${escapeHtml(settings.title)}
        </span>
        <br><br>
        <span style="font-family: 'Noto Serif', Georgia, serif; font-size: 15px; font-weight: 700; color: ${COLORS.primary};">
          ${escapeHtml(brand.name)}
        </span>
        <br>
        <span style="font-size: 12px; font-style: italic; color: ${COLORS.muted};">
          ${escapeHtml(brand.tagline)}
        </span>
        <br><br>
        <table cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: ${COLORS.muted};">
          <tbody>
            <tr>
              <td style="padding-bottom: 3px;">
                <a href="mailto:${escapeHtml(settings.email)}" style="color: ${COLORS.primary}; text-decoration: none;">
                  ${escapeHtml(settings.email)}
                </a>
              </td>
            </tr>
            ${phoneHtml}
            <tr>
              <td>
                <a href="${brand.websiteUrl}" style="color: ${COLORS.primary}; text-decoration: none;">
                  ${brand.website}
                </a>
              </td>
            </tr>
            ${parentHtml}
          </tbody>
        </table>
        ${socialIconsHtml}
      </td>
    </tr>
    ${promoBannerHtml}
  </tbody>
</table>
`.trim();
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
 * Generate the HTML signature for admin deployment
 */
function generateAdminSignatureHtml(user, emailAddress) {
  if (!user) {
    Logger.log('Error: User object is required');
    return '';
  }

  const name = (user.name && user.name.fullName) ? user.name.fullName : (user.primaryEmail ? user.primaryEmail.split('@')[0] : 'User');
  const title = getJobTitle(user);
  const phone = getPhoneNumber(user);
  const email = emailAddress || (user.primaryEmail || 'email@nyuchi.com');
  const brand = getBrandFromEmail(email);

  // Zimbabwe flag gradient (5 colors: green, yellow, red, black, white - 20% each)
  const flagGradient = `linear-gradient(to bottom, ${COLORS.flagGreen} 0%, ${COLORS.flagGreen} 20%, ${COLORS.flagYellow} 20%, ${COLORS.flagYellow} 40%, ${COLORS.flagRed} 40%, ${COLORS.flagRed} 60%, ${COLORS.flagBlack} 60%, ${COLORS.flagBlack} 80%, ${COLORS.flagWhite} 80%, ${COLORS.flagWhite} 100%)`;

  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #000000; max-width: 600px;">
  <tr>
    <!-- Zimbabwe Flag Strip - 4px Vertical Left Edge -->
    <td style="width: 4px; background: ${flagGradient}; padding: 0;"></td>

    <!-- Signature Content -->
    <td style="padding: 20px 0 20px 12px;">
      <!-- Division Logo (Primary) -->
      <div style="margin-bottom: 16px;">
        <img src="${brand.logo}" alt="${escapeHtml(brand.name)}" width="120" style="display: block; height: auto;">
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
            <a href="${brand.websiteUrl}" style="color: #000000; text-decoration: none;">${brand.website}</a>
          </td>
        </tr>
      </table>

      <!-- Parent Company (Nyuchi Africa) -->
      ${!brand.hideAttribution && brand.parent ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
        <tr>
          <td>
            <div style="font-size: 13px; color: #666666; margin-bottom: 4px;">A division of</div>
            <div style="font-size: 16px; font-weight: 700; color: #000000; margin-bottom: 4px;">${ADMIN_CONFIG.companyName}</div>
            <div style="font-size: 13px; font-style: italic; color: #000000;">${ADMIN_CONFIG.tagline}</div>
          </td>
        </tr>
      </table>` : `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
        <tr>
          <td>
            <div style="font-size: 16px; font-weight: 700; color: #000000; margin-bottom: 4px;">${ADMIN_CONFIG.companyName}</div>
            <div style="font-size: 13px; font-style: italic; color: #000000;">${ADMIN_CONFIG.tagline}</div>
          </td>
        </tr>
      </table>`}

      <!-- Ubuntu Footer -->
      <div style="margin-top: 16px; font-size: 11px; color: #000000;">
        ${ADMIN_CONFIG.ubuntuFooter}
      </div>

      <!-- Promotional Banner -->
      <div style="margin-top: 20px;">
        <a href="${ADMIN_CONFIG.banner.linkUrl}" style="display: block; text-decoration: none;">
          <img src="${ADMIN_CONFIG.banner.imageUrl}" alt="${ADMIN_CONFIG.banner.altText}" width="100%" style="display: block; max-width: 550px; height: auto; border-radius: 4px;">
        </a>
      </div>

    </td>
  </tr>
</table>
`.trim();
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape HTML special characters
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
// TEST FUNCTIONS
// ============================================================================

/**
 * Test signature generation with sample data
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

  const html = generateUserSignatureHtml(testSettings);
  Logger.log('Generated Signature HTML:');
  Logger.log(html);

  return html;
}

/**
 * Test admin signature generation
 */
function testAdminSignature() {
  const mockUser = {
    name: { fullName: 'Test User' },
    primaryEmail: 'test@lingo.nyuchi.com',
    organizations: [{ title: 'Software Engineer', primary: true }],
    phones: [{ value: '+263 77 123 4567', type: 'work' }]
  };

  const html = generateAdminSignatureHtml(mockUser, 'test@lingo.nyuchi.com');
  Logger.log('Generated Admin Signature HTML:');
  Logger.log(html);

  return html;
}
