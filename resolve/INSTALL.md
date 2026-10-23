# Installing the Brollvia plugin in DaVinci Resolve

**Honest status first:** this is a Blackmagic **Workflow Integration**
plugin (available in DaVinci Resolve Studio). Installing it is a manual
copy of one folder — there is no plugin store for these; this is the
workflow Blackmagic documents for Workflow Integration plugins.

## What you need

- DaVinci Resolve **Studio** 17 or newer (Workflow Integrations are a
  Studio feature).
- An API key from your Brollvia site: sign in → **Dashboard → Developer**
  → create a key with the `read`, `download` and `collections:write` scopes.

## Install

1. Download `brollvia-resolve-plugin.zip` from your Brollvia site's
   **Editors** page (`/editors`) and unzip it. You get a folder named
   `com.brollvia.resolve`.
2. Copy that folder into Resolve's Workflow Integration Plugins folder:
   - **macOS:** `~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Workflow Integration Plugins/`
     (i.e. `/Users/<you>/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Workflow Integration Plugins/com.brollvia.resolve`)
   - **Windows:** `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Fusion\Workflow Integration Plugins\`
     (per-user installs may instead use `%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion\Workflow Integration Plugins\`)
3. Restart DaVinci Resolve.
4. Open **Workspace → Workflow Integrations → Brollvia**.
5. In the panel, check the site URL (prefilled with the site you
   downloaded the plugin from), paste your API key, and click **Connect**.

## Using the panel

- Search with the filters, click a result for details, choose a size and
  click **Download**. The licence is recorded on your Brollvia account
  first; then the file is written to your Downloads folder (the panel log
  shows the exact path).
- Resolve's shell does not offer HTML plugins a documented Media Pool
  import call, so drag the saved file into your Media Pool — the panel log
  says exactly where it is.
- Pick a collection in "File downloads under" to also file the asset into
  that collection on your account.
- A Pro asset on a Free account shows the site's upgrade message and
  downloads nothing — same rule as the website.

Your API key is stored only in the plugin's local storage on this machine.
Revoke it any time from Dashboard → Developer.
