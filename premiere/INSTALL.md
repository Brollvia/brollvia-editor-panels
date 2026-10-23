# Installing the Brollvia panel in Adobe Premiere Pro

**Honest status first:** this panel is distributed as a sideload package,
not (yet) through Adobe Exchange. Sideloading is Adobe's own developer
workflow and takes about two minutes. A Marketplace/Exchange listing is a
later step.

## What you need

- Adobe Premiere Pro 23.0 or newer (UXP panels).
- The free **UXP Developer Tool** (Adobe Creative Cloud app → search
  "UXP Developer Tool", or https://developer.adobe.com/premiere-pro/uxp/).
- An API key from your Brollvia site: sign in → **Dashboard → Developer**
  → create a key with the `read`, `download` and `collections:write` scopes.

## Install (sideload via the UXP Developer Tool)

1. Download `brollvia-premiere-panel.ccx` from your Brollvia site's
   **Editors** page (`/editors`).
2. A `.ccx` file is a zip. Unzip it — you get a folder containing
   `manifest.json`, `index.html`, `core/` and `icons/`.
3. Open the **UXP Developer Tool**, click **Add Plugin**, and select the
   folder's `manifest.json`.
4. In the tool's plugin list, click **⋯ → Load** for "Brollvia".
5. In Premiere Pro: **Window → UXP Plugins → Brollvia**. (If the panel
   does not appear right away, untick and re-tick it in that menu —
   a known UXP quirk.)
6. In the panel, check the site URL (it is prefilled with the site you
   downloaded the panel from), paste your API key, and click **Connect**.

> Alternative: double-clicking a `.ccx` normally hands it to the Creative
> Cloud app, which can install distributed packages. For a sideloaded,
> self-hosted package like this one, the Developer Tool flow above is the
> reliable path.

## Using the panel

- Search with the filters (type, orientation), click a result for details,
  pick a download size and click **Download**. The licence is recorded on
  your Brollvia account first; then you choose a folder and the file is
  written there.
- The panel tries to import the saved file into your active project via
  Premiere's UXP API. Whether it succeeded is written in the **Panel log**
  at the bottom of the panel — if your Premiere build lacks the API, the
  log says so and you import the saved file manually (File → Import).
- Pick a collection in "File downloads under" to also file the asset into
  that collection on your account.
- A Pro asset on a Free account shows the site's upgrade message and no
  file is downloaded — same rule as the website.

Your API key is stored only in the plugin's local storage on this machine.
Revoke it any time from Dashboard → Developer.
