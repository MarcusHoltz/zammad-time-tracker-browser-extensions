const get = id => document.getElementById(id);

// If a type was previously saved, seed the dropdown with it so it shows
// on open even before the user clicks Fetch.
function preselectType(name) {
  const select = get('activityTypeSelect');
  const match = [...select.options].find(o => o.value === name);
  if (match) {
    select.value = name;
  } else if (name) {
    select.add(new Option(name, name, true, true));
  }
}

chrome.storage.local.get(
  ['zammadUrl', 'zammadToken', 'signature', 'includeTime', 'darkMode', 'activityTypeEnabled', 'activityTypeName'],
  ({ zammadUrl, zammadToken, signature, includeTime, darkMode, activityTypeEnabled, activityTypeName }) => {
    if (zammadUrl)  get('url').value       = zammadUrl;
    if (zammadToken) get('token').value    = zammadToken;
    if (signature)  get('signature').value = signature;

    get('includeTime').checked         = !!includeTime;
    get('darkMode').checked            = !!darkMode;
    get('activityTypeEnabled').checked = !!activityTypeEnabled;

    if (darkMode)            document.body.classList.add('dark');
    if (activityTypeEnabled) get('activityTypeSection').style.display = 'block';
    if (activityTypeName)    preselectType(activityTypeName);
  }
);

get('darkMode').addEventListener('change', () => {
  document.body.classList.toggle('dark', get('darkMode').checked);
});

get('activityTypeEnabled').addEventListener('change', () => {
  get('activityTypeSection').style.display =
    get('activityTypeEnabled').checked ? 'block' : 'none';
});

// Pulls unique type names from the monthly activity log.
// Tries the current month first, then the previous month as a fallback
// (useful at the start of a new month before any entries exist).
get('fetchTypesBtn').onclick = async () => {
  const url    = get('url').value.trim().replace(/\/+$/, '');
  const token  = get('token').value.trim();
  const status = get('fetchStatus');

  if (!url || !token) {
    status.style.color = 'red';
    status.textContent = 'Save your URL and Token first.';
    return;
  }

  status.style.color = '#888';
  status.textContent = 'Fetching...';

  const fetchLog = async (year, month) => {
    const res = await fetch(`${url}/api/v1/time_accounting/log/by_activity/${year}/${month}`, {
      credentials: 'omit',
      headers: { 'Authorization': `Token token=${token}` }
    });
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return res.json();
  };

  try {
    const now = new Date();
    let log = await fetchLog(now.getFullYear(), now.getMonth() + 1);

    if (!log.length) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      log = await fetchLog(prev.getFullYear(), prev.getMonth() + 1);
    }

    const types = [...new Set(log.map(e => e.type).filter(Boolean))].sort();

    if (!types.length) {
      status.style.color = '#888';
      status.textContent = 'No activity types found in recent log entries.';
      return;
    }

    const select  = get('activityTypeSelect');
    const current = select.value;
    select.innerHTML = '<option value="">-- select a type --</option>';
    types.forEach(name => select.add(new Option(name, name)));
    if (current) select.value = current;

    status.style.color = 'green';
    status.textContent = `Loaded ${types.length} type${types.length === 1 ? '' : 's'}.`;
  } catch (e) {
    status.style.color = 'red';
    status.textContent = `Failed: ${e.message}`;
  }
};

get('saveBtn').onclick = () => {
  const url                 = get('url').value.trim().replace(/\/+$/, '');
  const token               = get('token').value.trim();
  const signature           = get('signature').value.trim();
  const includeTime         = get('includeTime').checked;
  const darkMode            = get('darkMode').checked;
  const activityTypeEnabled = get('activityTypeEnabled').checked;
  const activityTypeName    = get('activityTypeSelect').value;
  const msg                 = get('msg');

  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    msg.style.color = 'red';
    msg.textContent = 'URL must start with http:// or https://';
    return;
  }
  if (!token) {
    msg.style.color = 'red';
    msg.textContent = 'API token is required.';
    return;
  }
  if (activityTypeEnabled && !activityTypeName) {
    msg.style.color = 'red';
    msg.textContent = 'Select an activity type or disable the feature.';
    return;
  }

  chrome.storage.local.set(
    { zammadUrl: url, zammadToken: token, signature, includeTime, darkMode, activityTypeEnabled, activityTypeName },
    () => {
      msg.style.color = 'green';
      msg.textContent = 'Saved.';
    }
  );
};
