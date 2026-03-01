const get = id => document.getElementById(id);

chrome.storage.local.get(['zammadUrl', 'zammadToken', 'signature', 'includeTime', 'darkMode'], ({ zammadUrl, zammadToken, signature, includeTime, darkMode }) => {
  if (zammadUrl)   get('url').value       = zammadUrl;
  if (zammadToken) get('token').value     = zammadToken;
  if (signature)   get('signature').value = signature;
  get('includeTime').checked = !!includeTime;
  get('darkMode').checked    = !!darkMode;
  if (darkMode) document.body.classList.add('dark');
});

// Apply immediately when toggled, before saving
get('darkMode').addEventListener('change', () => {
  document.body.classList.toggle('dark', get('darkMode').checked);
});

get('saveBtn').onclick = () => {
  const url         = get('url').value.trim().replace(/\/+$/, '');
  const token       = get('token').value.trim();
  const signature   = get('signature').value.trim();
  const includeTime = get('includeTime').checked;
  const darkMode    = get('darkMode').checked;
  const msg         = get('msg');

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

  chrome.storage.local.set({ zammadUrl: url, zammadToken: token, signature, includeTime, darkMode }, () => {
    msg.style.color = 'green';
    msg.textContent = 'Saved.';
  });
};
