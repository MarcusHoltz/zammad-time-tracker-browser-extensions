# Zammad Time Tracker — Firefox

Track and submit time to Zammad tickets directly from Firefox.

---

## Install (until Mozilla approves the addon)

1. Download this repo → **Code → Download ZIP**, unzip it
2. Firefox → `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Select any file inside the unzipped folder
4. Done — the icon appears in your toolbar

> Temporary add-ons unload when Firefox closes. 

---

## Configure

**Right-click the toolbar icon → Preferences**

| Field | Value |
|---|---|
| Base URL | `https://support.yourcompany.com` — no trailing slash |
| API Token | Zammad → Profile → Token Access → **Create** (`ticket.agent` permission required) |
| Note Signature | Appended to every submitted note, e.g. `Logged via browser` |
| Include time in note | Adds `Time submitted: X min` to the note body |
| Dark mode | ✓ |

**Save.**

---

## Usage

| Step | Action |
|---|---|
| 1 | Type a ticket ID → **Load** |
| 2 | **Start** → work → **Pause** |
| 3 | Forgot to pause? Click the time field, type the correct value (`01:30:00`) |
| 4 | Add a note (optional) → **Submit Time** |

Existing time entries load below the ticket. Click any value to edit → **Save**.

---

## Requirements

- Firefox 128+
- Zammad 6.x with Time Accounting enabled (`Admin → Time Accounting`)
- API token with `ticket.agent` permission

---

## Privacy Policy

Zammad Time Tracker **does not** collect, transmit, or share any personal data.

All data entered into the extension — including your Zammad URL, API token, ticket IDs, timer state, and notes — is stored exclusively in your browser using chrome.storage.local.

This storage is sandboxed to the extension and is not accessible to any website or third party.

The only outbound network requests made by this extension are to the Zammad URL you configured yourself. No data is sent to the extension, a library, bug tracking, error logs, some random developer, or any third party of any kind.

**There are no analytics, no telemetry, and no remote logging of any kind.**
