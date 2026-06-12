# Publishing Checklist

## 1. Create the GitHub repository

Create a public GitHub repository:

```text
https://github.com/deemsd/timeline-calendar
```

Do not initialize it with a README, license, or `.gitignore`; this local repository already contains those files.

## 2. Create the current release

After the repository has been pushed, create a GitHub release with:

- Tag: `1.0.2`
- Release title: `Timeline Calendar 1.0.2`
- Assets:
  - `main.js`
  - `manifest.json`
  - `styles.css`

Use the prepared files from:

```text
/Users/zhenglipei/Documents/Codex/2026-06-03/new-chat/outputs/timeline-calendar-release-assets
```

`versions.json` should be committed to the repository. It is also included in the prepared release assets folder for convenience, but Obsidian's first release only needs `main.js`, `manifest.json`, and `styles.css`.

## 3. Submit to Obsidian Community directory

1. Go to <https://community.obsidian.md>.
2. Sign in with your Obsidian account.
3. Link your GitHub account.
4. Open **Plugins**.
5. Select **New plugin**.
6. Submit your GitHub repository URL.
7. Confirm the developer policies and submit.

The submitted repository's default branch must contain the correct `manifest.json`, and the GitHub release tag must match the version in that manifest.

## 4. After approval

Future updates only need a new GitHub release with an incremented `manifest.json` version and matching release tag.
