// Lightweight i18n for the Zammad Time Tracker extension.
//
// The language is user-selectable in Settings and stored as `language`
// ('en' or 'de') in chrome.storage.local. Both popup.html and settings.html
// load this file before their own script, then call setLang()/applyStaticI18n().
//
// Dictionary values are either plain strings or functions (for interpolation).
// Static markup is translated via data-i18n* attributes:
//   data-i18n             -> textContent
//   data-i18n-html        -> innerHTML  (only trusted, built-in markup)
//   data-i18n-placeholder -> placeholder
//   data-i18n-title       -> title

const I18N = {
  en: {
    // --- Settings (static) ---
    settingsTitle:       'Zammad Settings',
    baseUrl:             'Base URL',
    baseUrlHint:         '(no trailing slash)',
    apiToken:            'API Token',
    noteSignature:       'Note Signature',
    noteSignatureHint:   '(appended to every note)',
    includeTime:         'Include submitted time in note body',
    languageLabel:       'Language',
    darkMode:            'Dark mode',
    activityTypeEnable:  'Enable Activity Type on submission',
    fetchTypes:          'Fetch Types',
    activityTypeHint:    'Types must be enabled and established. Find them at:<br>' +
                         '<strong>Admin &rarr; Time Accounting &rarr; Activity Types</strong>.',
    save:                'Save',
    urlPlaceholder:      'https://support.example.com',
    tokenPlaceholder:    'Your Zammad API token',
    signaturePlaceholder:'e.g. Logged via Zammad Browser Extension',

    // --- Settings (dynamic) ---
    saved:               'Saved.',
    saveUrlTokenFirst:   'Save your URL and Token first.',
    fetching:            'Fetching...',
    urlMustStart:        'URL must start with http:// or https://',
    tokenRequired:       'API token is required.',
    selectTypeOrDisable: 'Select an activity type or disable the feature.',
    noTypesFound:        'No active activity types found. Create them at Admin → Time Accounting → Activity Types.',
    loadedTypes:         n => `Loaded ${n} type${n === 1 ? '' : 's'}.`,
    fetchFailed:         msg => `Failed: ${msg}`,
    selectAType:         '-- select a type --',
    clickFetch:          '-- click Fetch --',

    // --- Popup (static) ---
    ticketPlaceholder:   'Ticket ID',
    loadId:              'Load ID',
    loadIdTitle:         'Load Internal Ticket ID (much shorter than Ticket#)',
    ticketNum:           'Ticket#',
    ticketNumTitle:      'Use Ticket# (customer ticket number? use this button!)',
    existingEntries:     'Existing entries',
    start:               'Start',
    pause:               'Pause',
    reset:               'Reset',
    notePlaceholder:     'Note (optional)',
    submitTime:          'Submit Time',
    timeInputTitle:      'Edit time manually, e.g. 01:30:00',

    // --- Popup (dynamic) ---
    loading:             'Loading...',
    totalAccounted:      n => `Total accounted: ${n} min`,
    minutesTitle:        'Minutes - edit and press Save',
    invalidTime:         'Invalid time value.',
    entryUpdated:        'Entry updated.',
    deleteEntryTitle:    n => `Delete ${n} min entry`,
    deleteThisEntry:     'Delete this entry?',
    yes:                 'Yes',
    no:                  'No',
    entryDeleted:        'Entry deleted.',
    resolvingNum:        'Resolving ticket number...',
    resolved:            (raw, id) => `Resolved #${raw} → ID ${id}`,
    nothingToSubmit:     'Nothing to submit - timer is at zero.',
    submitting:          'Submitting...',
    submitted:           n => `Submitted ${n} min.`,
    notConfigured:       'Zammad not configured. Open Settings.',
    couldNotParse:       raw => `Could not parse a ticket number from "${raw}".`,
    noTicketFound:       n => `No ticket found with number ${n}.`,

    // --- Submitted note body (written into the Zammad ticket) ---
    noteTimeSubmitted:   n => `time submitted: ${n} min`,
    noteActivityType:    name => `activity type: ${name}`,
    noteDefault:         'Time logged via extension'
  },

  de: {
    // --- Einstellungen (statisch) ---
    settingsTitle:       'Zammad Einstellungen',
    baseUrl:             'Basis-URL',
    baseUrlHint:         '(ohne abschließenden Schrägstrich)',
    apiToken:            'API-Token',
    noteSignature:       'Notiz-Signatur',
    noteSignatureHint:   '(wird an jede Notiz angehängt)',
    includeTime:         'Erfasste Zeit in den Notiztext aufnehmen',
    languageLabel:       'Sprache',
    darkMode:            'Dunkelmodus',
    activityTypeEnable:  'Aktivitätstyp beim Senden aktivieren',
    fetchTypes:          'Typen abrufen',
    activityTypeHint:    'Typen müssen aktiviert und eingerichtet sein. Zu finden unter:<br>' +
                         '<strong>Admin &rarr; Zeiterfassung &rarr; Aktivitätstypen</strong>.',
    save:                'Speichern',
    urlPlaceholder:      'https://support.example.com',
    tokenPlaceholder:    'Ihr Zammad API-Token',
    signaturePlaceholder:'z. B. Erfasst via Zammad Browser-Erweiterung',

    // --- Einstellungen (dynamisch) ---
    saved:               'Gespeichert.',
    saveUrlTokenFirst:   'Bitte zuerst URL und Token speichern.',
    fetching:            'Wird abgerufen...',
    urlMustStart:        'Die URL muss mit http:// oder https:// beginnen.',
    tokenRequired:       'API-Token ist erforderlich.',
    selectTypeOrDisable: 'Bitte einen Aktivitätstyp wählen oder die Funktion deaktivieren.',
    noTypesFound:        'Keine aktiven Aktivitätstypen gefunden. Erstellen Sie diese unter Admin → Zeiterfassung → Aktivitätstypen.',
    loadedTypes:         n => `${n} Typ${n === 1 ? '' : 'en'} geladen.`,
    fetchFailed:         msg => `Fehlgeschlagen: ${msg}`,
    selectAType:         '-- Typ auswählen --',
    clickFetch:          '-- Abrufen klicken --',

    // --- Popup (statisch) ---
    ticketPlaceholder:   'Ticket-ID',
    loadId:              'ID laden',
    loadIdTitle:         'Interne Ticket-ID laden (deutlich kürzer als Ticket#)',
    ticketNum:           'Ticket#',
    ticketNumTitle:      'Ticket# verwenden (Kunden-Ticketnummer? diesen Knopf nutzen!)',
    existingEntries:     'Vorhandene Einträge',
    start:               'Start',
    pause:               'Pause',
    reset:               'Zurücksetzen',
    notePlaceholder:     'Notiz (optional)',
    submitTime:          'Zeit senden',
    timeInputTitle:      'Zeit manuell bearbeiten, z. B. 01:30:00',

    // --- Popup (dynamisch) ---
    loading:             'Wird geladen...',
    totalAccounted:      n => `Gesamt erfasst: ${n} min`,
    minutesTitle:        'Minuten – bearbeiten und Speichern drücken',
    invalidTime:         'Ungültiger Zeitwert.',
    entryUpdated:        'Eintrag aktualisiert.',
    deleteEntryTitle:    n => `Eintrag mit ${n} min löschen`,
    deleteThisEntry:     'Diesen Eintrag löschen?',
    yes:                 'Ja',
    no:                  'Nein',
    entryDeleted:        'Eintrag gelöscht.',
    resolvingNum:        'Ticketnummer wird aufgelöst...',
    resolved:            (raw, id) => `#${raw} → ID ${id} aufgelöst`,
    nothingToSubmit:     'Nichts zu senden – Timer steht auf null.',
    submitting:          'Wird gesendet...',
    submitted:           n => `${n} min gesendet.`,
    notConfigured:       'Zammad ist nicht konfiguriert. Einstellungen öffnen.',
    couldNotParse:       raw => `Aus "${raw}" konnte keine Ticketnummer ermittelt werden.`,
    noTicketFound:       n => `Kein Ticket mit der Nummer ${n} gefunden.`,

    // --- Gesendeter Notiztext (wird ins Zammad-Ticket geschrieben) ---
    noteTimeSubmitted:   n => `Erfasste Zeit: ${n} min`,
    noteActivityType:    name => `Aktivitätstyp: ${name}`,
    noteDefault:         'Zeit über Erweiterung erfasst'
  }
};

let LANG = 'en';

function setLang(lang) {
  LANG = I18N[lang] ? lang : 'en';
}

// Looks up a key for the current language, falling back to English then the
// key itself. Function values are called with the supplied args.
function t(key, ...args) {
  const dict = I18N[LANG] || I18N.en;
  let val = dict[key];
  if (val === undefined) val = I18N.en[key];
  if (val === undefined) return key;
  return typeof val === 'function' ? val(...args) : val;
}

// Applies translations to every element carrying a data-i18n* attribute.
function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}
