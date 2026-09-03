# 2.2.5

## Fixed

- Fixed missing events after switching months when Obsidian's Daily Notes folder still pointed to an older month. Timeline Calendar now scans the configured daily note base folder recursively, including year and month subfolders.
- Unified note lookup for loading, creating, editing, and deleting events so these operations use the same folder scope.
- Limited live calendar updates to daily notes within the configured folder.
- Fixed inconsistent time detection caused by reused regular expressions.
- Improved event titles by removing inline start times and time ranges after parsing them.
- Preserved the default 30-minute duration for tasks with a due date and a start time but no explicit end time.
- Excluded indented list items from standalone calendar events.

## Settings

The **Daily note base folder** setting now controls both calendar scanning and note creation. Set it to the parent folder containing your year/month folders. Leave it empty to use Obsidian's Daily Notes folder.

Your existing notes do not need to be moved or reformatted.
