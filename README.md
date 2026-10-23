# Brollvia Editor Panels

Search, preview and download licensed Brollvia footage, photos, music and SFX **without leaving your editor**. Every download writes a real licence record to your Brollvia account, so the clips in your timeline are covered.

**Get the panels:** [brollvia.com/editors](https://brollvia.com/editors) — the downloads from that page arrive pre-configured with your site URL. This repository holds the panel source code.

## What is inside

| Folder | Contents |
|---|---|
| `panel-core/` | The shared panel UI (vanilla JS/CSS) used by both hosts |
| `premiere/` | Adobe Premiere Pro panel (UXP, packaged as a `.ccx`) — see `premiere/INSTALL.md` |
| `resolve/` | DaVinci Resolve Workflow Integration plugin — see `resolve/INSTALL.md` |

## How it connects

The panels talk to the Brollvia REST API with a personal API key:

1. Sign in at [brollvia.com](https://brollvia.com) and open **Settings → Developer** to create an API key (downloads need the `download` scope).
2. Open the panel in your editor and paste the key. It is stored only in the panel local storage on your machine.
3. Search, preview, and download — free assets download immediately; Pro assets follow your plan, exactly as on the website.

## Notes

- Premiere Pro 23.0 or later (UXP). Sideload the `.ccx` with the Adobe UXP Developer Tool; an Adobe Exchange listing is planned.
- DaVinci Resolve integration uses the Workflow Integration API (Studio).
- The panels never see your password — only the revocable API key.

Media downloaded through the panels is licensed under the [Brollvia Licence](https://brollvia.com/licence).
