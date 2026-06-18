import useFileStore from '@/stores/fileStore';
import {
  getAllDailyNotes,
  getDailyNote,
  getDailyNoteSettings,
  getTemplateInfo,
} from 'obsidian-daily-notes-interface';
import {App, normalizePath, TFile} from 'obsidian';

class FileService {
  public getState() {
    return useFileStore.getState();
  }

  public setApp(app: App) {
    useFileStore.getState().setApp(app);
    return app;
  }

  public initAllFiles() {
    const files = getAllDailyNotes();
    useFileStore.getState().setFiles(files);
    return;
  }

  public async getAllFiles() {
    const files = getAllDailyNotes();
    useFileStore.getState().setFiles(files);
    return files;
  }

  /**
   * Get all daily notes and update the store
   * This method is used by the BigCalendar component
   *
   * @returns Promise resolving to the daily notes
   */
  public async getMyAllDailyNotes() {
    return this.getAllFiles();
  }

  public async createDailyNote(date: moment.Moment): Promise<TFile> {
    const app = this.getState().app;
    if (!app) throw new Error('App not initialized');

    const existingDailyNote = getDailyNote(date, getAllDailyNotes());
    if (existingDailyNote) return existingDailyNote;

    const targetPath = await this.getMonthlyDailyNotePath(date);
    const targetFile = app.vault.getFileByPath(targetPath);
    if (targetFile) return targetFile;

    await this.ensureFolderExists(targetPath.split('/').slice(0, -1).join('/'));

    const templateContent = await this.getDailyNoteTemplateContent(date);
    return await app.vault.create(targetPath, templateContent);
  }

  public async getDailyNoteByEvent(date: moment.Moment): Promise<TFile> {
    const files = this.getState().files || (await this.getAllFiles());
    const dailyNote = getDailyNote(date, files);
    return dailyNote;
  }

  /**
   * Get the file by event ID
   *
   * @param eventId ID of the event
   * @returns The TFile object for the event
   */
  public getFile(event: Model.Event): TFile | null {
    const app = this.getState().app;
    if (!app) return null;

    // Assuming the event ID represents a path or part of a path to the file
    const file = app.vault.getFileByPath(event.path);
    return file || null;
  }

  /**
   * Get the path of the daily notes folder
   *
   * @returns Path to the daily notes folder
   */
  public getDailyNotePath(): string {
    const dailyNotesSetting = getDailyNoteSettings();
    const dailyNotePath = dailyNotesSetting.folder;
    return dailyNotePath;
  }

  private async getMonthlyDailyNotePath(date: moment.Moment): Promise<string> {
    const dailyNotesSetting = getDailyNoteSettings();
    const baseFolder = normalizePath(dailyNotesSetting.folder || '');
    const yearFolder = normalizePath(baseFolder ? `${baseFolder}/${date.format('YYYY')}` : date.format('YYYY'));
    await this.ensureFolderExists(yearFolder);
    const monthFolder = normalizePath(`${yearFolder}/${date.format('YYYY-MM')}`);
    await this.ensureFolderExists(monthFolder);

    const format = dailyNotesSetting.format || 'YYYY-MM-DD';
    const noteName = date.format(format).split('/').pop() || date.format('YYYY-MM-DD');
    const fileName = noteName.endsWith('.md') ? noteName : `${noteName}.md`;

    return normalizePath(`${monthFolder}/${fileName}`);
  }

  private async getDailyNoteTemplateContent(date: moment.Moment): Promise<string> {
    const dailyNotesSetting = getDailyNoteSettings();
    const template = dailyNotesSetting.template || '';
    const format = dailyNotesSetting.format || 'YYYY-MM-DD';
    const title = date.format(format).split('/').pop() || date.format('YYYY-MM-DD');
    const [templateContent] = await getTemplateInfo(template);

    return templateContent
      .replace(/{{\s*date\s*}}/gi, title)
      .replace(/{{\s*time\s*}}/gi, moment().format('HH:mm'))
      .replace(/{{\s*title\s*}}/gi, title)
      .replace(
        /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
        (
          _match: string,
          _timeOrDate: string,
          calc: string | undefined,
          timeDelta: string | undefined,
          unit: moment.unitOfTime.DurationConstructor | undefined,
          momentFormat: string | undefined,
        ) => {
          const now = moment();
          const currentDate = date.clone().set({
            hour: now.get('hour'),
            minute: now.get('minute'),
            second: now.get('second'),
          });
          if (calc && timeDelta && unit) currentDate.add(parseInt(timeDelta, 10), unit);
          if (momentFormat) return currentDate.format(momentFormat.substring(1).trim());
          return currentDate.format(format);
        },
      )
      .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, 'day').format(format))
      .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, 'day').format(format));
  }

  private folderExists(path: string): boolean {
    const app = this.getState().app;
    if (!app) return false;

    return app.vault.getFolderByPath(normalizePath(path)) !== null;
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const app = this.getState().app;
    if (!app || !path) return;

    const normalizedPath = normalizePath(path);
    if (this.folderExists(normalizedPath)) return;

    const parts = normalizedPath.split('/').filter(Boolean);
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!this.folderExists(currentPath)) {
        await app.vault.createFolder(currentPath);
      }
    }
  }

  /**
   * Read the content of a file
   *
   * @param filePath Path to the file
   * @returns Promise resolving to the file content
   */
  public async readFileContent(filePath: string): Promise<string> {
    const app = this.getState().app;
    if (!app) throw new Error('App not initialized');

    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return await app.vault.read(file);
  }

  /**
   * Write content to a file
   *
   * @param filePath Path to the file
   * @param content Content to write
   * @returns Promise resolving when write is complete
   */
  public async writeFileContent(filePath: string, content: string): Promise<void> {
    const app = this.getState().app;
    if (!app) throw new Error('App not initialized');

    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return await app.vault.modify(file, content);
  }
}

const fileService = new FileService();

export default fileService;
