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
    throw new Error('Zammad not configured. Open Settings.');
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
    body: note || 'Time logged via extension',
    internal: true,
    time_unit: parseFloat(minutes.toFixed(4))
  };
  if (typeName) article.accounted_time_type = typeName;
  return zammadFetch(`/api/v1/tickets/${ticketId}`, {
    method: 'PUT',
    body: JSON.stringify({ article })
  });
}

/**
 * /api/v1/tickets/{ticket_id}/time_accountings/{id}
 * Requires admin.time_accounting permission in Zammad.
 */
async function patchTimeAccounting(ticketId, entryId, minutes) {
  return zammadFetch(`/api/v1/tickets/${ticketId}/time_accountings/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify({ time_unit: String(parseFloat(minutes.toFixed(4))) })
  });
}

// ---------------------------------------------------------------------------
// Timer helpers
// ---------------------------------------------------------------------------

async function deleteTimeAccounting(ticketId, entryId) {
  return zammadFetch(`/api/v1/tickets/${ticketId}/time_accountings/${entryId}`, {
    method: 'DELETE'
  });
}

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

// -- Timer --

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

  $('toggleBtn').textContent = running ? 'Pause' : 'Start';
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
  $('accountedTime').textContent = `Total accounted: ${parseFloat(total.toFixed(2))} min`;
}

async function refreshTicketData(ticketId) {
  try {
    const entries = await zammadFetch(`/api/v1/tickets/${ticketId}/time_accountings`);
    const total = entries.reduce((sum, e) => sum + parseFloat(e.time_unit || '0'), 0);
    $('accountedTime').textContent = `Total accounted: ${parseFloat(total.toFixed(2))} min`;
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
    input.title = 'Minutes - edit and press Save';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'save';
    saveBtn.onclick = async () => {
      const minutes = parseFloat(input.value);
      if (isNaN(minutes) || minutes < 0) { setStatus('Invalid time value.', 'error'); return; }
      saveBtn.disabled = true;
      try {
        await patchTimeAccounting(ticketId, entry.id, minutes);
        setStatus('Entry updated.', 'ok');
        refreshTicketData(ticketId);
      } catch (e) {
        setStatus(e.message, 'error');
        saveBtn.disabled = false;
      }
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '-';
    delBtn.className = 'del';
    delBtn.title = `Delete ${parseFloat(entry.time_unit).toFixed(2)} min entry`;
    delBtn.onclick = () => {
      // Replace the row with an inline yes/no prompt.
      // Chrome's native confirm() freezes the extension popup and puts the
      // dialog buttons out of reach — this avoids that entirely.
      row.innerHTML = '';

      const msg = document.createElement('span');
      msg.className = 'entry-date';
      msg.textContent = 'Delete this entry?';

      const yesBtn = document.createElement('button');
      yesBtn.textContent = 'Yes';
      yesBtn.className = 'save';
      yesBtn.onclick = async () => {
        yesBtn.disabled = true;
        noBtn.disabled = true;
        try {
          await deleteTimeAccounting(ticketId, entry.id);
          setStatus('Entry deleted.', 'ok');
        } catch (e) {
          setStatus(e.message, 'error');
        }
        refreshTicketData(ticketId);
      };

      const noBtn = document.createElement('button');
      noBtn.textContent = 'No';
      noBtn.onclick = () => refreshTicketData(ticketId);

      row.append(msg, yesBtn, noBtn);
    };

    row.append(date, type, input, saveBtn, delBtn);
    list.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

$('loadBtn').onclick = async () => {
  const id = $('ticketInput').value.trim();

  // Empty ID — reset everything to blank state
  if (!id) {
    await store.set({ ticketId: null, accumulatedMs: 0, startedAt: null });
    ['ticketInfo', 'entriesSection'].forEach(el => ($(''+el).style.display = 'none'));
    $('ticketTitle').textContent = '';
    $('accountedTime').textContent = '';
    $('entriesList').innerHTML = '';
    setStatus('');
    render();
    return;
  }

  setStatus('Loading...');
  try {
    const [ticket, entries] = await Promise.all([
      zammadFetch(`/api/v1/tickets/${id}`),
      zammadFetch(`/api/v1/tickets/${id}/time_accountings`)
    ]);

    const s = await store.get(['ticketId']);
    if (s.ticketId !== String(id)) {
      await store.set({ ticketId: String(id), accumulatedMs: 0, startedAt: null });
    }

    showTicketInfo(ticket.title, entries);
    renderEntries(String(id), await resolveTypeNames(entries));
    setStatus('');
    render();
  } catch (e) {
    setStatus(e.message, 'error');
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

// Snapshot and pause before reading
  const ms = elapsed(s);
  await store.set({ accumulatedMs: ms, startedAt: null });
  render();

  if (ms < 1000) { setStatus('Nothing to submit - timer is at zero.', 'error'); return; }

  setStatus('Submitting...');
  try {
    const minutes = ms / 60000;
   // Build note body from user input, optional time line, and optional signature

    const parts = [
      $('note').value.trim(),
      s.includeTime                               && `time submitted: ${parseFloat(minutes.toFixed(2))} min`,
      s.activityTypeEnabled && s.activityTypeName && `activity type: ${s.activityTypeName}`,
      s.signature
    ].filter(Boolean);

    const note = parts.join('\n') || 'Time logged via extension';
    await postTimeAccounting(s.ticketId, minutes, note, s.activityTypeEnabled ? s.activityTypeName : null);

    // Reset timer on success
    await store.set({ accumulatedMs: 0, startedAt: null, note: '' });
    $('note').value = '';
    setStatus(`Submitted ${parseFloat(minutes.toFixed(2))} min.`, 'ok');

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
  const s = await store.get(['ticketId', 'zammadUrl', 'zammadToken', 'darkMode', 'note']);
  if (s.darkMode) document.body.classList.add('dark');
  if (s.note) $('note').value = s.note;

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
