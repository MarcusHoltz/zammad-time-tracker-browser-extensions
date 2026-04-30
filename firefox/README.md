# Zammad Time Tracker — Firefox <img src='https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/zammad-time-tracker-firefox.png' align="right" width="25%" min-width="120px"/>


[Track and submit time to Zammad tickets directly from Firefox.](https://addons.mozilla.org/en-US/firefox/addon/zammad-time-tracker/)  


---

## Install

1. Visit the [Zammad Time Tracker by Holtzweb](https://addons.mozilla.org/en-US/firefox/addon/zammad-time-tracker/) Firefox browser add-on
2. Click on **'5'** stars
3. Download and install with "Add to Firefox" button
4. Done — the icon appears in your toolbar


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

- Firefox 128+
- Zammad 6.x
- API token with `ticket.agent` permission
- (optional) Time Accounting Types enabled in your Zammad admin settings (`Admin → Time Accounting`)


---

## Enabling Time Accounting & Activity Types in Zammad (optional)

If you do not see any **Activity Types** in the Zammad Settings - you may need to setup your Time Accounting in Zammad.

> This will guide you through setting up time accounting, type of time accounting (tags), and makeing the time accounting modal appear when updating tickets.


* * *

### Step 1: Enable Time Accounting

1. Go to **Admin → Time Accounting → Settings**
2. Enable **Time Accounting**
3. Enable **Time Accounting Types** if you want the activity type dropdown in the modal
4. Click **Save**


* * *

### Step 2: Configure the Selector

The selector tells Zammad which tickets should show the time accounting dialog when an article is submitted. Without at least one condition the dialog will never appear.

1. Still in the **Time Accounting** go to the **Settings** tab, and find the **Selector** section
2. Click **Configure** next to *"Show time accounting dialog when updating matching tickets"*
3. Add a condition — for example:
   - **Attribute:** `Ticket#`
   - **Operator:** `is`
   - **Value:** *(select the number of your test ticket)*
4. Click **Save**

> If you want the dialog to appear on every ticket, set a condition that all tickets satisfy (e.g. `Ticket # is none of 0` ).


* * *

### Step 3: Create Activity Types

1. Go to **Admin → Time Accounting → Activity Types**
2. Create the types your team will use, e.g. *Research*, *Development*, *Meeting*, *Billable*, *Non-Billable*
3. Make sure each type is set to **Active**

> Activity types must exist and be active before they can be selected in the extension or in the Zammad UI.


* * *

### Step 4: Test

1. Open a ticket that matches your selector conditions
2. Write a reply or internal note
3. Click **Update**
4. The **Time Accounting** modal should appear asking for time and (if configured) an activity type


---


## Privacy Policy

Zammad Time Tracker **does not** collect, transmit, or share any personal data.

All data entered into the extension — including your Zammad URL, API token, ticket IDs, timer state, and notes — is stored exclusively in your browser using chrome.storage.local.

This storage is sandboxed to the extension and is not accessible to any website or third party.

The only outbound network requests made by this extension are to the Zammad URL you configured yourself. No data is sent to the extension, a library, bug tracking, error logs, some random developer, or any third party of any kind.

**There are no analytics, no telemetry, and no remote logging of any kind.**
