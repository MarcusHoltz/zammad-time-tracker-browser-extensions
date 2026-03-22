# Zammad Time Tracker — Chromium <img src='https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/zammad-time-tracker-chrome.png' align="right" width="25%" min-width="120px"/>


[Track and submit time to Zammad tickets directly from Chrome.](https://chromewebstore.google.com/detail/gocmjpkkdjfgbakcjahehcogmgpopjdk) 


---

## Install (until Google approves the addon)

0. Download the [Zammad Time Tracker](https://chromewebstore.google.com/detail/gocmjpkkdjfgbakcjahehcogmgpopjdk) in the Chrome web store
1. Download this repo as a ZIP → **Code → Download ZIP** and unzip it
2. Open Chrome → `chrome://extensions` → enable **Developer mode** (top right)
3. Click **Load unpacked** → select the unzipped folder
4. Pin the extension from the puzzle-piece menu

---

## Configure

Click the extension icon → **right-click → Options**

| Field | What to put |
|---|---|
| Base URL | Your Zammad URL, e.g. `https://support.yourcompany.com` |
| API Token | Profile → Token Access → **Create** (needs `ticket.agent` permission) |
| Note Signature | Optional. Appended to every time note, e.g. `Logged via browser` |
| Include time in note | Adds `time submitted: X min` to the note body |
| Dark mode | ✓ |
| Enable Activity Type | Allows time to be tracked with an activity type (e.g. `Billable`). |

Hit **Save**. Done.

---

## Usage

| Step | Action |
|---|---|
| 1 | Type a ticket ID → **Load** |
| 2 | Current time entries are displayed. | 
| 2 | **Start** → work → **Pause** |
| 3 | Forgot to pause? Click the time field, type the correct value (`01:30:00`) |
| 4 | Add a note (optional) → **Submit Time** |
| 5 | Edit a time entry → **Save**. 
| 6 | Remove a time entry → red **-** button

---

## Requirements

- Chrome (or any Chromium based browser)
- Zammad 6.x
- API token with `ticket.agent` permission
- (optional) Time Accounting enabled in your Zammad admin settings (`Admin → Time Accounting`)

---

## Privacy Policy

Zammad Time Tracker **does not** collect, transmit, or share any personal data.

All data entered into the extension — including your Zammad URL, API token, ticket IDs, timer state, and notes — is stored exclusively in your browser using chrome.storage.local.

This storage is sandboxed to the extension and is not accessible to any website or third party.

The only outbound network requests made by this extension are to the Zammad URL you configured yourself. No data is sent to the extension, a library, bug tracking, error logs, some random developer, or any third party of any kind.

**There are no analytics, no telemetry, and no remote logging of any kind.**
