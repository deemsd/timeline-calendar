import {normalizePath, TFile, TFolder, Vault} from 'obsidian';
import {getDailyNoteSettings, getDateFromFile, getDateUID} from 'obsidian-daily-notes-interface';
import globalService from '@/services/globalService';

/** Reading and writing use the same root, including nested year/month folders. */
export function getCalendarDailyNoteFolder(): string {
  const configured = globalService.getState().pluginSetting?.DailyNoteCreateBaseFolder?.trim();
  return normalizePath(configured || getDailyNoteSettings().folder || '/');
}

export function isCalendarDailyNote(file: unknown): file is TFile {
  if (!(file instanceof TFile) || file.extension !== 'md') return false;
  const root = getCalendarDailyNoteFolder();
  return (root === '/' || file.path.startsWith(`${root}/`)) && !!getDateFromFile(file, 'day');
}

export function getAllDailyNotes(): Record<string, TFile> {
  const app = globalService.getPlugin()?.app;
  if (!app) return {};
  const folder = app.vault.getAbstractFileByPath(getCalendarDailyNoteFolder());
  if (!(folder instanceof TFolder)) throw new Error('Daily notes folder not found');
  const notes: Record<string, TFile> = {};
  Vault.recurseChildren(folder, file => {
    if (isCalendarDailyNote(file)) {
      notes[getDateUID(getDateFromFile(file, 'day'), 'day')] = file;
    }
  });
  return notes;
}
