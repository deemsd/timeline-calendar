import {TFile, normalizePath, Notice} from 'obsidian';
import {moment} from 'obsidian';
import {createDailyNote, getAllDailyNotes, getDailyNote} from 'obsidian-daily-notes-interface';
import {insertAfterHandler} from './createEvent';
import fileService from '../services/fileService';
import {getAllLinesFromFile, getDailyNotePath, safeExecute} from '../api';
import {extractDeletedEventId, extractDeletedEventContent, extractDeletedEventDate} from '../utils/regexGenerators';
import {parseLine} from './parser';

/**
 * Deletes the event's original line from the daily note that owns it.
 *
 * Calendar event IDs include the parsed line index, but files can move while
 * Obsidian is open, so this also falls back to matching the parsed content.
 */
export async function deleteEventFromDailyNote(event: Model.Event): Promise<void> {
  const {app} = fileService.getState();

  if (!app) {
    throw new Error('App not initialized');
  }

  const file = getSourceFileForEvent(event);
  if (!file) {
    throw new Error(`Source file not found for event: ${event.title}`);
  }

  const fileContents = await app.vault.read(file);
  const fileLines = getAllLinesFromFile(fileContents);
  const lineIndex = findEventLineForDelete(fileLines, event);

  if (lineIndex === -1) {
    throw new Error(`Could not find event line in ${file.path}: ${event.title}`);
  }

  fileLines.splice(lineIndex, 1);
  await app.vault.modify(file, fileLines.join('\n'));
}

function getSourceFileForEvent(event: Model.Event): TFile | null {
  const {app} = fileService.getState();

  if (event.path) {
    const file = app.vault.getFileByPath(event.path);
    if (file instanceof TFile) {
      return file;
    }
  }

  const dailyNotes = getAllDailyNotes();
  return getDailyNote(moment(event.start), dailyNotes) || null;
}

function findEventLineForDelete(fileLines: string[], event: Model.Event): number {
  for (const lineIndex of getCandidateLineIndexes(event.id, fileLines.length)) {
    if (lineMatchesEvent(fileLines[lineIndex], event, true)) {
      return lineIndex;
    }
  }

  for (let i = 0; i < fileLines.length; i++) {
    if (lineMatchesEvent(fileLines[i], event, true)) {
      return i;
    }
  }

  for (let i = 0; i < fileLines.length; i++) {
    if (lineMatchesEvent(fileLines[i], event, false)) {
      return i;
    }
  }

  return -1;
}

function getCandidateLineIndexes(eventId: string, lineCount: number): number[] {
  const indexes = new Set<number>();
  const lineSuffix = eventId.match(/^\d{14}(\d+)$/)?.[1] || eventId.match(/_L(\d+)$/)?.[1];

  if (!lineSuffix) {
    return [];
  }

  const parsedIndex = Number.parseInt(lineSuffix, 10);
  if (!Number.isFinite(parsedIndex)) {
    return [];
  }

  indexes.add(parsedIndex);
  indexes.add(parsedIndex - 1);

  return [...indexes].filter((index) => index >= 0 && index < lineCount);
}

function lineMatchesEvent(line: string, event: Model.Event, strict: boolean): boolean {
  if (!isListLine(line)) {
    return false;
  }

  const parsedLine = parseLine(line);
  const eventType = event.eventType || '';

  if (strict && eventType.startsWith('TASK-') && !parsedLine.isTask) {
    return false;
  }

  if (event.blockLink && !line.includes(`^${event.blockLink}`)) {
    return false;
  }

  const lineContent = normalizeEventContent(parsedLine.content || line);

  for (const targetContent of getTargetContents(event)) {
    if (lineContent === targetContent) {
      return strict ? eventTimeMatches(parsedLine, event) : true;
    }

    if (!strict && (lineContent.includes(targetContent) || targetContent.includes(lineContent))) {
      return true;
    }
  }

  return false;
}

function getTargetContents(event: Model.Event): string[] {
  const contents = [event.title, event.originalContent].filter((content): content is string => !!content);
  return [...new Set(contents.map((content) => normalizeEventContent(content)))];
}

function isListLine(line: string): boolean {
  return /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
}

function normalizeEventContent(content: string): string {
  return content
    .replace(/^\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\s+/, '')
    .replace(/⏲\s?\d{1,2}:\d{2}(?::\d{2})?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function eventTimeMatches(parsedLine: ReturnType<typeof parseLine>, event: Model.Event): boolean {
  if (event.allDay || !parsedLine.startTime) {
    return true;
  }

  const eventStart = moment(event.start);
  return parsedLine.startTime.hour === eventStart.hour() && parsedLine.startTime.minute === eventStart.minute();
}

interface DeletedEventInfo {
  id?: string;
  content?: string;
  user_id?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt: string | moment.Moment;
}

/**
 * Restores a deleted event from the delete.md file back to its original daily note
 *
 * @param deletedEventid The ID of the deleted event to restore
 * @returns Promise resolving to an array with the restored event info
 */
export async function restoreDeletedEvent(deletedEventid: string): Promise<DeletedEventInfo[]> {
  return await safeExecute(async () => {
    const {vault, metadataCache} = fileService.getState().app;

    if (!/\d{14,}/.test(deletedEventid)) {
      throw new Error('Invalid event ID format');
    }

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    if (!(deleteFile instanceof TFile)) {
      throw new Error('Delete file not found');
    }

    const fileContents = await vault.read(deleteFile);
    const fileLines = getAllLinesFromFile(fileContents);

    if (fileLines.length === 0) {
      return [];
    }

    const lineNum = parseInt(deletedEventid.slice(14));
    const line = fileLines[lineNum - 1];
    const newDeletefileContents = fileContents.replace(line, '');
    await vault.modify(deleteFile, newDeletefileContents);

    if (!/^- (.+)$/.test(line)) {
      return [];
    }

    const id = extractDeletedEventId(line);
    const date = moment(id, 'YYYYMMDDHHmmss');
    const timeHour = date.format('HH');
    const timeMinute = date.format('mm');

    const newEvent = `- ${timeHour}:${timeMinute} ${extractDeletedEventContent(line)}`;
    const dailyNotes = getAllDailyNotes();
    const existingFile = getDailyNote(date, dailyNotes);

    if (!existingFile) {
      const file = await createDailyNote(date);
      const fileContents = await vault.read(file);
      const newFileContent = await insertAfterHandler('- ', newEvent, fileContents);
      await vault.modify(file, newFileContent.content);
    } else {
      const fileContents = await vault.read(existingFile);
      const newFileContent = await insertAfterHandler('- ', newEvent, fileContents);
      await vault.modify(existingFile, newFileContent.content);
    }

    return [{deletedAt: ''}];
  }, 'Failed to restore deleted event');
}

/**
 * Permanently deletes an event from the delete.md file
 *
 * @param deletedEventid The ID of the deleted event to remove permanently
 * @returns Promise resolving to void
 */
export async function deleteForever(deletedEventid: string): Promise<void> {
  return await safeExecute(async () => {
    const {vault, metadataCache} = fileService.getState().app;

    if (!/\d{14,}/.test(deletedEventid)) {
      throw new Error('Invalid event ID format');
    }

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    if (!(deleteFile instanceof TFile)) {
      return;
    }

    const fileContents = await vault.read(deleteFile);
    const fileLines = getAllLinesFromFile(fileContents);

    if (fileLines.length === 0) {
      return;
    }

    const lineNum = parseInt(deletedEventid.slice(14));
    const line = fileLines[lineNum - 1];

    if (/^- (.+)$/.test(line)) {
      const newFileContent = fileContents.replace(line, '');
      await vault.modify(deleteFile, newFileContent);
    }
  }, 'Failed to permanently delete event');
}

/**
 * Retrieves all deleted events from the delete.md file
 *
 * @returns Promise resolving to an array of deleted events
 */
export async function getDeletedEvents(): Promise<DeletedEventInfo[]> {
  return await safeExecute(async () => {
    const {vault, metadataCache} = fileService.getState().app;
    const deletedEvents: DeletedEventInfo[] = [];

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    if (!(deleteFile instanceof TFile)) {
      return deletedEvents;
    }

    const fileContents = await vault.read(deleteFile);
    const fileLines = getAllLinesFromFile(fileContents);

    if (fileLines.length === 0) {
      return deletedEvents;
    }

    for (let i = 0; i < fileLines.length; i++) {
      const line = fileLines[i];

      if (!/- /.test(line)) {
        continue;
      }

      const id = extractDeletedEventId(line);
      if (!id) continue;

      const timeString = id.slice(0, 13);
      const createdDate = moment(timeString, 'YYYYMMDDHHmmss');
      const deletedDateID = extractDeletedEventDate(line);
      if (!deletedDateID) continue;

      const deletedDate = moment(deletedDateID.slice(0, 13), 'YYYYMMDDHHmmss');
      const content = extractDeletedEventContent(line);
      if (!content) continue;

      deletedEvents.push({
        id: deletedDateID,
        content: content,
        user_id: 1,
        createdAt: createdDate.format('YYYY/MM/DD HH:mm:SS'),
        updatedAt: createdDate.format('YYYY/MM/DD HH:mm:SS'),
        deletedAt: deletedDate,
      });
    }

    return deletedEvents;
  }, 'Failed to get deleted events');
}

/**
 * Sends an event to the delete.md file
 *
 * @param eventContent The content of the event to delete
 * @returns Promise resolving to the deletion date
 */
export const sendEventToDelete = async (eventContent: string): Promise<string> => {
  return await safeExecute(async () => {
    const {metadataCache, vault} = fileService.getState().app;

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    const date = moment();
    const deleteDate = date.format('YYYY/MM/DD HH:mm:ss');

    if (deleteFile instanceof TFile) {
      const fileContents = await vault.read(deleteFile);
      const fileLines = getAllLinesFromFile(fileContents);

      let lineNum;
      if (fileLines.length === 1 && fileLines[0] === '') {
        lineNum = 1;
      } else {
        lineNum = fileLines.length + 1;
      }

      const deleteDateID = date.format('YYYYMMDDHHmmss') + lineNum;
      await createDeleteEventInFile(deleteFile, fileContents, eventContent, deleteDateID);

      return deleteDate;
    } else {
      const deleteFilePath = normalizePath(absolutePath);
      const file = await createdeleteFile(deleteFilePath);

      const lineNum = 1;
      const deleteDateID = date.format('YYYYMMDDHHmmss') + lineNum;

      await createDeleteEventInFile(file, '', eventContent, deleteDateID);

      return deleteDate;
    }
  }, 'Failed to send event to delete');
};

/**
 * Creates a deleted event entry in the delete.md file
 *
 * @param file The delete.md file
 * @param fileContent The current content of the file
 * @param eventContent The content of the event to delete
 * @param deleteDate The deletion date
 * @returns Promise resolving to true if successful
 */
export const createDeleteEventInFile = async (
  file: TFile,
  fileContent: string,
  eventContent: string,
  deleteDate: string,
): Promise<boolean> => {
  return await safeExecute(async () => {
    const {vault} = fileService.getState().app;
    let newContent: string;

    if (fileContent === '') {
      newContent = eventContent + ' deletedAt: ' + deleteDate;
    } else {
      newContent = fileContent + '\n' + eventContent + ' deletedAt: ' + deleteDate;
    }

    await vault.modify(file, newContent);

    return true;
  }, 'Failed to create delete event in file');
};

/**
 * Creates the delete.md file if it doesn't exist
 *
 * @param path The path where to create the file
 * @returns Promise resolving to the created file
 */
export const createdeleteFile = async (path: string): Promise<TFile> => {
  return await safeExecute(async () => {
    const {vault} = fileService.getState().app;

    try {
      const createdFile = await vault.create(path, '');
      return createdFile;
    } catch (err) {
      console.error(`Failed to create file: '${path}'`, err);
      new Notice('Unable to create new file.');
      throw err;
    }
  }, 'Failed to create delete file');
};
