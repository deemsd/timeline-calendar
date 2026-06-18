# Timeline Calendar

Timeline Calendar is an Obsidian calendar plugin for daily notes and tasks. It provides month, week, day, and agenda views, with a cleaner timeline layout where time labels align with the grid lines.

<img width="1112" height="714" alt="截屏2026-06-18 15 08 15" src="https://github.com/user-attachments/assets/e4e3c359-cde8-4e4a-8dd2-36ea82c05dbe" />



## Features

- Month, week, day, and agenda calendar views
- Reads time-stamped tasks and list items from daily notes
- Supports timed events, all-day tasks, drag and drop, and resizing
- Opens the original note when you select an event
- Cleaner timeline gutter with line-aligned time labels
- Compact event layout for dense task schedules

## Time Formats

Timeline Calendar recognizes entries like:

```md
- [ ] 08:30 Morning meeting
- [ ] 09:00-12:00 Project planning
- 14:00 Review notes
```

## Settings

- Choose whether the week starts on Sunday or Monday
- Choose the heading where new events are inserted
- Choose which section of daily notes is processed for events
- Configure the visible time range for week and day views

## Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Put them in your vault under `.obsidian/plugins/timeline-calendar/`.
3. Reload Obsidian.
4. Enable **Timeline Calendar** in Community plugins.

## Development

```bash
npm install
npm run build
```

The build writes `main.js` and `styles.css` to the repository root.

## License

MIT. See [LICENSE](LICENSE).
