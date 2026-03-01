/**
 * Storage keys:
 *   zammadUrl     - base URL, no trailing slash
 *   zammadToken   - API token
 *   ticketId      - currently loaded ticket ID (string)
 *   accumulatedMs - ms logged in paused periods
 *   startedAt     - epoch ms when last started, or null if paused
 *
 * Timer uses timestamps, not a counter. Elapsed = accumulatedMs + (now - startedAt).
 * No background worker needed.
 */

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
    credentials: 'omit', // must omit — browser session cookie triggers CSRF check
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

async function fetchTicket(id) {
  return zammadFetch(`/api/v1/tickets/${id}`);
}

/**
 * PUT /api/v1/tickets/:id
 * Passing an article with time_unit creates both the note and the time accounting
 * entry in one operation, keeping them linked in Zammad.
 * Omit accounted_time_type_id if not needed — Zammad accepts it either way.
 */
async function postTimeAccounting(ticketId, minutes, note) {
  return zammadFetch(`/api/v1/tickets/${ticketId}`, {
    method: 'PUT',
    body: JSON.stringify({
      article: {
        body: note || 'Time logged via extension',
        internal: true,
        time_unit: parseFloat(minutes.toFixed(4))
      }
    })
  });
}

/**
 * PATCH /api/v1/tickets/{ticket_id}/time_accountings/{id}
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

function msToHMS(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

/** Returns ms from "HH:MM:SS", or null if invalid. */
function hmsToms(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.length !== 3 || parts.some(n => isNaN(n) || n < 0)) return null;
  const [h, m, s] = parts;
  if (m >= 60 || s >= 60) return null;
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
  $('status').className   = type; // '', 'error', or 'ok'
}

async function render() {
  const s = await store.get(['ticketId', 'accumulatedMs', 'startedAt']);
  const hasTicket = !!s.ticketId;
  const running   = !!s.startedAt;

  $('toggleBtn').disabled = !hasTicket;
  $('resetBtn').disabled  = !hasTicket;
  $('submitBtn').disabled = !hasTicket;
  $('toggleBtn').textContent = running ? 'Pause' : 'Start';

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

function showTicketInfo(title, totalMinutes) {
  $('ticketInfo').style.display = 'block';
  $('ticketTitle').textContent  = title;
  $('accountedTime').textContent =
    `Total accounted: ${parseFloat(totalMinutes.toFixed(2))} min`;
}

async function refreshAccountedTime(ticketId) {
  try {
    const entries = await zammadFetch(`/api/v1/tickets/${ticketId}/time_accountings`);
    const total = entries.reduce((sum, e) => sum + parseFloat(e.time_unit || '0'), 0);
    $('accountedTime').textContent =
      `Total accounted: ${parseFloat(total.toFixed(2))} min`;
    renderEntries(ticketId, entries);
  } catch (_) {
    // Non-fatal
  }
}

function renderEntries(ticketId, entries) {
  const section = $('entriesSection');
  const list    = $('entriesList');
  list.innerHTML = '';

  if (!entries.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  entries.forEach(entry => {
    const date = new Date(entry.created_at).toLocaleDateString();
    const row  = document.createElement('div');
    row.className = 'entry-row';

    const dateSpan = document.createElement('span');
    dateSpan.className   = 'entry-date';
    dateSpan.textContent = date;

    const input = document.createElement('input');
    input.type  = 'text';
    input.value = parseFloat(entry.time_unit).toFixed(2);
    input.title = 'Minutes — edit and click Save';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = async () => {
      const minutes = parseFloat(input.value);
      if (isNaN(minutes) || minutes < 0) {
        setStatus('Invalid time value.', 'error');
        return;
      }
      saveBtn.disabled = true;
      try {
        await patchTimeAccounting(ticketId, entry.id, minutes);
        setStatus('Entry updated.', 'ok');
        refreshAccountedTime(ticketId);
      } catch (e) {
        setStatus(e.message, 'error');
        saveBtn.disabled = false;
      }
    };

    row.appendChild(dateSpan);
    row.appendChild(input);
    row.appendChild(saveBtn);
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
    $('ticketInfo').style.display   = 'none';
    $('entriesSection').style.display = 'none';
    $('ticketTitle').textContent    = '';
    $('accountedTime').textContent  = '';
    $('entriesList').innerHTML      = '';
    setStatus('');
    render();
    return;
  }

  setStatus('Loading…');

  try {
    const [ticket, entries] = await Promise.all([
      fetchTicket(id),
      zammadFetch(`/api/v1/tickets/${id}/time_accountings`)
    ]);

    const total = entries.reduce((sum, e) => sum + parseFloat(e.time_unit || '0'), 0);

    const s = await store.get(['ticketId']);
    if (s.ticketId !== String(id)) {
      await store.set({ ticketId: String(id), accumulatedMs: 0, startedAt: null });
    }

    showTicketInfo(ticket.title, total);
    renderEntries(String(id), entries);
    setStatus('');
    render();
  } catch (e) {
    setStatus(e.message, 'error');
  }
};

$('toggleBtn').onclick = async () => {
  const s = await store.get(['accumulatedMs', 'startedAt']);
  if (s.startedAt) {
    await store.set({ accumulatedMs: elapsed(s), startedAt: null });
  } else {
    await store.set({ startedAt: Date.now() });
  }
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
  const s = await store.get(['startedAt']);
  // Keep running if it was running, but restart the clock from now with new base
  await store.set({ accumulatedMs: ms, startedAt: s.startedAt ? Date.now() : null });
  render();
});

$('submitBtn').onclick = async () => {
  const s = await store.get(['ticketId', 'accumulatedMs', 'startedAt', 'signature', 'includeTime']);

  // Snapshot and pause before reading
  const ms = elapsed(s);
  await store.set({ accumulatedMs: ms, startedAt: null });
  render();

  if (ms < 1000) {
    setStatus('Nothing to submit — timer is at zero.', 'error');
    return;
  }

  setStatus('Submitting…');

  try {
    const minutes = ms / 60000;

    // Build note body from user input, optional time line, and optional signature
    const parts = [];
    const userNote = $('note').value.trim();
    if (userNote) parts.push(userNote);
    if (s.includeTime) parts.push(`Time submitted: ${parseFloat(minutes.toFixed(2))} min`);
    if (s.signature)   parts.push(s.signature);
    const note = parts.join('\n') || 'Time logged via extension';

    await postTimeAccounting(s.ticketId, minutes, note);

    // Reset timer on success
    await store.set({ accumulatedMs: 0, startedAt: null, note: '' });
    $('note').value = '';
    setStatus(`Submitted ${parseFloat(minutes.toFixed(2))} min.`, 'ok');

    // Refresh the accounted total so user can see it updated
    refreshAccountedTime(s.ticketId);
    render();
  } catch (e) {
    setStatus(e.message, 'error');
  }
};

// Persist note across popup open/close
$('note').addEventListener('input', () => {
  store.set({ note: $('note').value });
});

(async () => {
  const s = await store.get(['ticketId', 'zammadUrl', 'zammadToken', 'darkMode', 'note']);
  if (s.darkMode) document.body.classList.add('dark');
  if (s.note) $('note').value = s.note;

  if (s.ticketId) {
    $('ticketInput').value = s.ticketId;

    if (s.zammadUrl && s.zammadToken) {
      try {
        const [ticket, entries] = await Promise.all([
          fetchTicket(s.ticketId),
          zammadFetch(`/api/v1/tickets/${s.ticketId}/time_accountings`)
        ]);
        const total = entries.reduce((sum, e) => sum + parseFloat(e.time_unit || '0'), 0);
        showTicketInfo(ticket.title, total);
        renderEntries(s.ticketId, entries);
      } catch (_) {
        // Non-fatal if offline or token expired
      }
    }
  }

  render();
})();
