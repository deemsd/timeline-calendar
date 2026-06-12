# Reconstruction Notes

This source tree was reconstructed from the closest matching local source package found at:

`/Users/zhenglipei/Documents/Codex/2026-06-03/new-chat/timeline-calendar-release`

That package's `main.js` SHA-256 matched the currently installed Timeline Calendar plugin exactly:

`c833d31f35c715c19e8687fb5ca2e385f8e52d45f5fe943f0e4994058005fd17`

The installed plugin had a newer `styles.css` with additional layout fixes, so this reconstructed tree also:

- copies the installed plugin's current `styles.css`
- appends the corresponding Week/Day all-day row alignment fixes to `src/less/Calendar.less`

## Verification

The root release files in this directory match the installed plugin:

- `main.js`
- `styles.css`
- `manifest.json`

The source was also build-tested using a compatible existing `node_modules` directory from:

`/Users/zhenglipei/Documents/Codex/2026-06-03/new-chat/work/timeline-calendar-source/node_modules`

The build completed successfully, but the generated `main.js` was not kept because that borrowed dependency tree does not reproduce the installed plugin byte-for-byte. After the build test, the root release files were restored from the currently installed plugin.

## Recommended Use

Use this directory as the working source baseline for future changes.

Canonical source location:

`/Users/zhenglipei/Library/Mobile Documents/com~apple~CloudDocs/01-个人资料/软件/软件编写/timeline-calendar-source`

Installed Obsidian plugin location:

`/Users/zhenglipei/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian/.macbook/plugins/timeline-calendar`

Before shipping a rebuilt plugin, install dependencies in this directory from `package-lock.json`, build, and test in a temporary Obsidian plugin folder before replacing the active plugin.
