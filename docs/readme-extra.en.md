## Requirements

- Windows — the host uses the Win32 `SendInput` API
- [Node.js](https://nodejs.org)
- A tablet, phone or second computer with a browser on the same network

Nothing else. The C# helper and tray app are compiled by the .NET Framework compiler that already ships with Windows, so there is no SDK to install.

## Getting started

```sh
git clone https://github.com/sanwhere/surecut-deck.git
cd surecut-deck
npm install
start.cmd
```

`start.cmd` compiles the helpers on first run and puts an icon in the system tray. Click it for the address and pairing code, then open that address on the tablet.

## How it is put together

| Part | File | Role |
|---|---|---|
| Host | `server.js` | HTTP + WebSocket, configuration, action execution |
| Input | `helper/InputHelper.cs` | Win32 `SendInput`, long-lived process driven over stdin |
| Tray & editor | `tray/TrayApp.cs`, `tray/EditorForm.cs` | Manages the host; native editor window hosting the web UI |
| Interface | `public/` | The deck itself — buttons, editor, touchpad, themes |
| Translations | `public/i18n.js` | 20 languages in one flat dictionary |

Two decisions are worth explaining, because both are easy to get wrong:

**Input goes through a compiled helper, not PowerShell.** `SendKeys` cannot send the Windows key or media keys. The helper is a long-lived process reading commands from stdin, so there is no process-spawn latency on every keystroke.

**The desktop editor is a native window, not a browser tab.** Browsers never hand a web page the *path* of a dropped file, and Chromium resolves a dropped shortcut to its target — so dragging a shortcut into a browser cannot work, however it is written. The editor is a WinForms window hosting the same web interface in WebView2, which lets the native shell read real file paths.

## Security

Every connection from the network needs a pairing code, compared in constant time. Connections from the same machine skip it: anything already running there can send input directly, so a code would add nothing.

The `Run command` action executes arbitrary commands. **Anyone on your network who has the pairing code can run commands on your PC.** Keep the code to yourself, and don't host this on networks you don't trust.

The code lives in `data/token.txt`. Delete the file and restart to roll it.

## Tests

```sh
node tests/i18ntest.js          # all 20 languages complete and consistent
node tests/colormaptest.js      # theme colour mapping preserves hues
node tests/gesturetest.js       # two-finger scroll vs. pinch decision
node tests/revisiontest.js      # stale clients cannot overwrite newer config
node tests/smoketest.js <code>  # end-to-end; verifies key injection via NumLock
node tests/mousetest.js         # mouse injection — don't touch the mouse while it runs
```

## Building the documentation

This README and the HTML guide are generated from the same content files, so a new language is one JSON file and no template changes:

```sh
node docs/build-guide.js en              # docs/guide-en.html
node docs/build-guide.js en --inline     # single self-contained file
node docs/build-readme.js en             # this README
powershell -File docs/frame-shots.ps1    # bake tablet frames into screenshots
```

Turkish developer notes, including the traps found along the way, are in [docs/notes.tr.md](docs/notes.tr.md).
