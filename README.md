# Surecut Deck

Turn a spare tablet into a control deck for your Windows PC.

Surecut Deck runs a small server on your PC and serves its own interface. The tablet just opens a web address — there is no app to install, no account to create, and nothing leaves your network.

Buttons send **real** Windows input (`SendInput`), so any program responds to them: keyboard shortcuts, typed text, launching apps, running commands, or turning the whole tablet screen into a touchpad.

📖 **[Read the illustrated guide](docs/guide-en.html)** — also in [Türkçe](docs/guide-tr.html), [Español](docs/guide-es.html), [Français](docs/guide-fr.html), [العربية](docs/guide-ar.html)

---

## What it does

| | |
|---|---|
| **Keyboard shortcut** | Any combination — `ctrl+c`, `win+d`, `alt+f4`, media keys, volume |
| **Type text** | Writes a block of text for you |
| **Open app / file** | A program, a document or a folder |
| **Open web address** | Opens a link in your default browser |
| **Run command** | PowerShell or CMD |
| **Mouse** | Turns the tablet screen into a touchpad, with gestures |
| **Sequence** | Several steps in order, with delays in between |

Plus: 11 themes, 20 interface languages, multiple pages with swipe navigation, drag-and-drop shortcuts from the Windows desktop (icon included), auto-hiding bars, and a floating menu.

## Requirements

- Windows (the host uses Win32 `SendInput`)
- [Node.js](https://nodejs.org)
- A tablet, phone or second computer with a browser on the same network

Nothing else. The C# helper and tray app are compiled by the bundled .NET Framework compiler that ships with Windows — there is no SDK to install.

## Getting started

```
git clone https://github.com/sanwhere/surecut-deck.git
cd surecut-deck
npm install
start.cmd
```

`start.cmd` compiles the helpers on first run and puts an icon in the system tray. Click it to see the address and pairing code, then open that address on the tablet.

## How it is put together

| Part | File | Role |
|---|---|---|
| Host | `server.js` | HTTP + WebSocket, configuration, action execution |
| Input | `helper/InputHelper.cs` | Win32 `SendInput`, long-lived process driven over stdin |
| Tray & editor | `tray/TrayApp.cs`, `tray/EditorForm.cs` | Manages the host; native editor window hosting the web UI |
| Interface | `public/` | The deck itself — buttons, editor, touchpad, themes |
| Translations | `public/i18n.js` | 20 languages in one flat dictionary |

Two details worth knowing, because they are easy to get wrong:

**Input goes through a compiled helper, not PowerShell.** `SendKeys` cannot send the Windows key or media keys. The helper is a long-lived process reading commands from stdin, so there is no process-spawn latency per keystroke.

**The desktop editor is a native window, not a browser tab.** Browsers never hand a web page the *path* of a dropped file, and Chromium resolves a dropped shortcut to its target — so dragging a shortcut into a browser cannot work. The editor is a WinForms window hosting the same web UI in WebView2, which lets the native shell read real file paths.

## Security

Every connection from the network needs a pairing code, compared in constant time. Connections from the same machine skip it — anything already running there can send input directly, so a code adds nothing.

The `Run command` action executes arbitrary commands. **Anyone on your network who has the pairing code can run commands on your PC.** Keep the code to yourself and don't host this on networks you don't trust.

The pairing code lives in `data/token.txt`. Delete the file and restart to roll it.

## Tests

```
node tests\i18ntest.js         # all 20 languages complete and consistent
node tests\colormaptest.js     # theme colour mapping keeps hues
node tests\gesturetest.js      # two-finger scroll vs. pinch decision
node tests\revisiontest.js     # stale clients cannot overwrite newer config
node tests\smoketest.js <code> # end-to-end, verifies key injection via NumLock
node tests\mousetest.js        # mouse injection (don't touch the mouse while it runs)
```

## Documentation

The guide is generated from content files, so a new language is one JSON file and no template changes:

```
node docs\build-guide.js en            # docs/guide-en.html, images from docs/shots/
node docs\build-guide.js en --inline   # single self-contained file
```

Turkish developer notes, including the traps found along the way, are in [README.tr.md](README.tr.md).
