// Storage schema:
//   zammadUrl, zammadToken   - connection settings
//   ticketId                 - currently loaded ticket (string)
//   accumulatedMs            - ms banked before the current run
//   startedAt                - epoch ms of last start, null when paused
//   note                     - draft note persisted across popup open/close
//   signature                - text appended to every submitted note
//   includeTime              - bool: append "time submitted: X min" to note
//   activityTypeEnabled      - bool: send activity type on submit
//   activityTypeName         - activity type name as it appears in Zammad
//   language                 - UI language ('en' or 'de'), set in Settings
//
// The timer is timestamp-based, not counter-based.
//

const $ = id => document.getElementById(id);
const store = chrome.storage.local;

// ---------------------------------------------------------------------------
// Zammad API
// ---------------------------------------------------------------------------

async function zammadFetch(path, options = {}) {
  const { zammadUrl, zammadToken } = await store.get(['zammadUrl', 'zammadToken']);

  if (!zammadUrl || !zammadToken) {
    throw new Error(t('notConfigured'));
  }

  const res = await fetch(`${zammadUrl}${path}`, {
    ...options,
    credentials: 'omit', // omitting cookies prevents Zammad's CSRF check from firing
    headers: {
      'Authorization': `Token token=${zammadToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${res.status}: ${body.error_human || body.error || res.statusText}`);
  }

  return res.json();
}

// Creates a note + time entry in one operation by passing an article to PUT /tickets/:id.
// Zammad links both records atomically, which is why we use this over the bare time_accountings endpoint.
async function postTimeAccounting(ticketId, minutes, note, typeName = null) {
  const article = {
    body: note || t('noteDefault'),
    internal: true,
    time_unit: parseFloat(minutes.toFixed(4))
  };
  if (typeName) article.accounted_time_type = typeName;
  return zammadFetch(`/api/v1/tickets/${ticketId}`, {
    method: 'PUT',
    body: JSON.stringify({ article })
  });
}

// Requires admin.time_accounting permission in Zammad.
async function patchTimeAccounting(ticketId, entryId, minutes) {
  return zammadFetch(`/api/v1/tickets/${ticketId}/time_accountings/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify({ time_unit: String(parseFloat(minutes.toFixed(4))) })
  });
}

async function deleteTimeAccounting(ticketId, entryId) {
  return zammadFetch(`/api/v1/tickets/${ticketId}/time_accountings/${entryId}`, {
    method: 'DELETE'
  });
}

// Resolves a user-facing ticket number (e.g. 12345) to the internal ticket ID.
async function resolveTicketNumber(raw) {
  // Strip any prefix — accept "12345", "#12345", "Ticket#12345" etc.
  // Extracts only the trailing digit sequence.
  const normalized = raw.trim().replace(/^.*?(\d+)\s*$/, '$1');
  if (!normalized) {
    throw new Error(t('couldNotParse', raw));
  }

  // POST with an explicit ticket.number condition is the reliable exact-match
  // method per the Zammad API. GET-based free-text search may not match the
  // number field depending on the instance's search backend configuration.
  const data = await zammadFetch('/api/v1/tickets/search?full=true', {
    method: 'POST',
    body: JSON.stringify({
      condition: {
        'ticket.number': { operator: 'is', value: normalized }
      },
      limit: 1
    })
  });

  if (data.record_ids?.length) return String(data.record_ids[0]);

  throw new Error(t('noTicketFound', normalized));
}

// ---------------------------------------------------------------------------
// Active-tab ticket detection
// ---------------------------------------------------------------------------

// Extracts the internal ticket ID from a Zammad ticket-zoom URL, but only when
// the URL sits under the configured Base URL. Zammad routes look like
// `https://host/#ticket/zoom/12345`.
function ticketIdFromUrl(tabUrl, baseUrl) {
  if (!tabUrl || !baseUrl) return null;
  const base = baseUrl.replace(/\/+$/, '');
  if (!tabUrl.startsWith(base)) return null;
  const m = tabUrl.match(/#ticket\/zoom\/(\d+)/);
  return m ? m[1] : null;
}

// Reads the active tab's URL and returns the ticket ID it points at, or null.
async function detectTicketFromActiveTab(baseUrl) {
  if (!baseUrl) return null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return ticketIdFromUrl(tab?.url, baseUrl);
  } catch (_) {
    return null; // tabs API/permission unavailable — silently skip
  }
}

// ---------------------------------------------------------------------------
// Timer helpers
// ---------------------------------------------------------------------------

// Decorates entries with a human-readable typeName by matching created_at timestamps
// against the monthly activity log. Falls back to "#type_id" if the log is unavailable.
async function resolveTypeNames(entries) {
  if (!entries.length) return entries;

  const months = [...new Set(entries.map(e => {
    const d = new Date(e.created_at);
    return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`;
  }))];

  const nameByTimestamp = {};
  await Promise.all(months.map(async ym => {
    try {
      const log = await zammadFetch(`/api/v1/time_accounting/log/by_activity/${ym}`);
      log.forEach(item => {
        if (item.created_at && item.type) nameByTimestamp[item.created_at] = item.type;
      });
    } catch (_) { /* log endpoint may be unavailable - fallback below handles it */ }
  }));

  return entries.map(e => ({
    ...e,
    typeName: nameByTimestamp[e.created_at] ?? (e.type_id ? `#${e.type_id}` : null)
  }));
}

function msToHMS(ms) {
  const t = Math.floor(Math.max(0, ms) / 1000);
  return [Math.floor(t / 3600), Math.floor(t % 3600 / 60), t % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
}

// Returns ms for a "HH:MM:SS" string, or null if malformed
function hmsToms(str) {
  const [h, m, s] = str.trim().split(':').map(Number);
  if ([h, m, s].some(n => isNaN(n) || n < 0) || m >= 60 || s >= 60) return null;
  return (h * 3600 + m * 60 + s) * 1000;
}

function elapsed({ accumulatedMs = 0, startedAt = null }) {
  return accumulatedMs + (startedAt ? Date.now() - startedAt : 0);
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

let tickInterval = null;

function setStatus(msg, type = '') {
  $('status').textContent = msg;
  $('status').className = type;
}

async function render() {
  const s = await store.get(['ticketId', 'accumulatedMs', 'startedAt']);
  const hasTicket = !!s.ticketId;
  const running = !!s.startedAt;

  $('toggleBtn').textContent = running ? t('pause') : t('start');
  $('toggleBtn').disabled = !hasTicket;
  $('resetBtn').disabled  = !hasTicket;
  $('submitBtn').disabled = !hasTicket;

  if (document.activeElement !== $('timeInput')) {
    $('timeInput').value = msToHMS(elapsed(s));
  }

  clearInterval(tickInterval);
  if (running) {
    tickInterval = setInterval(async () => {
      if (document.activeElement === $('timeInput')) return;
      const s = await store.get(['accumulatedMs', 'startedAt']);
      $('timeInput').value = msToHMS(elapsed(s));
    }, 1000);
  }
}

function showTicketInfo(title, entries) {
  const total = entries.reduce((sum, e) => sum + parseFloat(e.time_unit || '0'), 0);
  $('ticketInfo').style.display = 'block';
  $('ticketTitle').textContent = title;
  $('accountedTime').textContent = t('totalAccounted', parseFloat(total.toFixed(2)));
}

async function refreshTicketData(ticketId) {
  try {
    const entries = await zammadFetch(`/api/v1/tickets/${ticketId}/time_accountings`);
    const total = entries.reduce((sum, e) => sum + parseFloat(e.time_unit || '0'), 0);
    $('accountedTime').textContent = t('totalAccounted', parseFloat(total.toFixed(2)));
    renderEntries(ticketId, await resolveTypeNames(entries));
  } catch (_) { /* non-fatal */ }
}

function renderEntries(ticketId, entries) {
  const list = $('entriesList');
  list.innerHTML = '';
  $('entriesSection').style.display = entries.length ? 'block' : 'none';

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'entry-row';

    const date = document.createElement('span');
    date.className = 'entry-date';
    date.textContent = new Date(entry.created_at).toLocaleDateString();

    const type = document.createElement('span');
    type.className = 'entry-type';
    type.textContent = entry.typeName || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = parseFloat(entry.time_unit).toFixed(2);
    input.title = t('minutesTitle');

    const saveBtn = document.createElement('button');
    saveBtn.textContent = t('save');
    saveBtn.className = 'save';
    saveBtn.onclick = async () => {
      const minutes = parseFloat(input.value);
      if (isNaN(minutes) || minutes < 0) { setStatus(t('invalidTime'), 'error'); return; }
      saveBtn.disabled = true;
      try {
        await patchTimeAccounting(ticketId, entry.id, minutes);
        setStatus(t('entryUpdated'), 'ok');
        refreshTicketData(ticketId);
      } catch (e) {
        setStatus(e.message, 'error');
        saveBtn.disabled = false;
      }
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '-';
    delBtn.className = 'del';
    delBtn.title = t('deleteEntryTitle', parseFloat(entry.time_unit).toFixed(2));
    delBtn.onclick = () => {
      // Replace the row with an inline yes/no prompt.
      // Chrome's native confirm() freezes the extension popup and puts the
      // dialog buttons out of reach — this avoids that entirely.
      row.innerHTML = '';

      const msg = document.createElement('span');
      msg.className = 'entry-date';
      msg.textContent = t('deleteThisEntry');

      const yesBtn = document.createElement('button');
      yesBtn.textContent = t('yes');
      yesBtn.className = 'save';
      yesBtn.onclick = async () => {
        yesBtn.disabled = true;
        noBtn.disabled = true;
        try {
          await deleteTimeAccounting(ticketId, entry.id);
          setStatus(t('entryDeleted'), 'ok');
        } catch (e) {
          setStatus(e.message, 'error');
        }
        refreshTicketData(ticketId);
      };

      const noBtn = document.createElement('button');
      noBtn.textContent = t('no');
      noBtn.onclick = () => refreshTicketData(ticketId);

      row.append(msg, yesBtn, noBtn);
    };

    row.append(date, type, input, saveBtn, delBtn);
    list.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Shared ticket load logic (used by both Load ID and # Lookup buttons)
// ---------------------------------------------------------------------------

async function loadTicketById(id) {
  if (!id) {
    await store.set({ ticketId: null, accumulatedMs: 0, startedAt: null });
    ['ticketInfo', 'entriesSection'].forEach(el => ($(el).style.display = 'none'));
    $('ticketTitle').textContent = '';
    $('accountedTime').textContent = '';
    $('entriesList').innerHTML = '';
    setStatus('');
    render();
    return;
  }

  setStatus(t('loading'));
  try {
    const [ticket, entries] = await Promise.all([
      zammadFetch(`/api/v1/tickets/${id}`),
      zammadFetch(`/api/v1/tickets/${id}/time_accountings`)
    ]);

    const s = await store.get(['ticketId']);
    if (s.ticketId !== String(id)) {
      await store.set({ ticketId: String(id), accumulatedMs: 0, startedAt: null });
    }

    $('ticketInput').value = String(id);
    showTicketInfo(ticket.title, entries);
    renderEntries(String(id), await resolveTypeNames(entries));
    setStatus('');
    render();
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

$('loadIdBtn').onclick = async () => {
  await loadTicketById($('ticketInput').value.trim());
};

$('loadNumBtn').onclick = async () => {
  const raw = $('ticketInput').value.trim();
  if (!raw) { await loadTicketById(''); return; }

  setStatus(t('resolvingNum'));
  $('loadNumBtn').disabled = true;
  try {
    const resolvedId = await resolveTicketNumber(raw);
    setStatus(t('resolved', raw, resolvedId));
    await loadTicketById(resolvedId);
  } catch (e) {
    setStatus(e.message, 'error');
  } finally {
    $('loadNumBtn').disabled = false;
  }
};

$('toggleBtn').onclick = async () => {
  const s = await store.get(['accumulatedMs', 'startedAt']);
  await store.set(s.startedAt
    ? { accumulatedMs: elapsed(s), startedAt: null }
    : { startedAt: Date.now() }
  );
  render();
};

$('resetBtn').onclick = async () => {
  await store.set({ accumulatedMs: 0, startedAt: null });
  setStatus('');
  render();
};

// Manual edit: parse on blur, revert if invalid
$('timeInput').addEventListener('blur', async () => {
  const ms = hmsToms($('timeInput').value);
  if (ms === null) { render(); return; }
  const { startedAt } = await store.get(['startedAt']);
  // Keep running if it was running, but restart the clock from now with new base
  await store.set({ accumulatedMs: ms, startedAt: startedAt ? Date.now() : null });
  render();
});

$('note').addEventListener('input', () => store.set({ note: $('note').value }));

$('submitBtn').onclick = async () => {
  const s = await store.get([
    'ticketId', 'accumulatedMs', 'startedAt',
    'signature', 'includeTime', 'activityTypeEnabled', 'activityTypeName'
  ]);

  // Snapshot and pause before submitting
  const ms = elapsed(s);
  await store.set({ accumulatedMs: ms, startedAt: null });
  render();

  if (ms < 1000) { setStatus(t('nothingToSubmit'), 'error'); return; }

  setStatus(t('submitting'));
  try {
    const minutes = ms / 60000;
    // Build note: user text, optional "time | type" line, optional signature.
    const timePart = s.includeTime
      ? t('noteTimeSubmitted', parseFloat(minutes.toFixed(2)))
      : null;
    const typePart = s.activityTypeEnabled && s.activityTypeName
      ? t('noteActivityType', s.activityTypeName)
      : null;
    const timeLine = [timePart, typePart].filter(Boolean).join(' | ') || null;

    const parts = [
      $('note').value.trim(),
      timeLine,
      s.signature
    ].filter(Boolean);

    const note = parts.join('\n') || t('noteDefault');
    const effectiveTypeName = s.activityTypeEnabled && s.activityTypeName
      ? s.activityTypeName
      : null;
    await postTimeAccounting(s.ticketId, minutes, note, effectiveTypeName);

    // Reset timer on success
    await store.set({ accumulatedMs: 0, startedAt: null, note: '' });
    $('note').value = '';
    setStatus(t('submitted', parseFloat(minutes.toFixed(2))), 'ok');

    // Refresh the accounted total so user can see it updated
    refreshTicketData(s.ticketId);
    render();
  } catch (e) {
    setStatus(e.message, 'error');
  }
};

// ---------------------------------------------------------------------------
// Init for tickets and time
// ---------------------------------------------------------------------------

(async () => {
  const s = await store.get([
    'ticketId', 'zammadUrl', 'zammadToken', 'darkMode', 'note',
    'startedAt', 'accumulatedMs', 'language'
  ]);

  setLang(s.language || 'en');
  applyStaticI18n();

  if (s.darkMode) document.body.classList.add('dark');
  if (s.note) $('note').value = s.note;

  // Auto-fill the ticket from the active tab's URL when it sits under the
  // configured Base URL. We only adopt it when the popup has no unsubmitted
  // time on another ticket, so a running/banked timer is never discarded.
  const urlTicketId  = await detectTicketFromActiveTab(s.zammadUrl);
  const hasUnsubmitted = !!s.startedAt || (s.accumulatedMs || 0) > 0;

  if (urlTicketId && urlTicketId !== s.ticketId && !hasUnsubmitted
      && s.zammadUrl && s.zammadToken) {
    // loadTicketById fetches the ticket, resets the timer and re-renders.
    await loadTicketById(urlTicketId);
    return;
  }

  if (s.ticketId && s.zammadUrl && s.zammadToken) {
    $('ticketInput').value = s.ticketId;
    try {
      const [ticket, entries] = await Promise.all([
        zammadFetch(`/api/v1/tickets/${s.ticketId}`),
        zammadFetch(`/api/v1/tickets/${s.ticketId}/time_accountings`)
      ]);
      showTicketInfo(ticket.title, entries);
      renderEntries(s.ticketId, await resolveTypeNames(entries));
    } catch (_) { /* non-fatal if offline or token expired */ }
  } else if (s.ticketId) {
    $('ticketInput').value = s.ticketId;
  }

  render();
})();
