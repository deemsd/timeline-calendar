import {Plugin, Notice} from 'obsidian';
import {BigCalendar} from './bigCalendar';
import {CALENDAR_VIEW_TYPE} from './constants';
import addIcons from './obComponents/customIcons';
import {BigCalendarSettingTab, DEFAULT_SETTINGS, BigCalendarSettings, normalizeVisibleTimeSettings} from './setting';
import {t} from './translations/helper';
import {fileService, eventService, globalService} from './services';
import useEventStore from './stores/eventStore';
import useCalendarStore from './stores/calendarStore';

// Reserved key inside data.json that stores transient view-state cache
// (calendar view, current date, app preference toggles, ...) so we can stay
// off browser-managed storage APIs that the Obsidian community
// review flags as a Recommendation.
const CACHE_DATA_KEY = '__cache__';

type PluginCache = Record<string, unknown>;
type PluginDataFile = Partial<BigCalendarSettings> & {[CACHE_DATA_KEY]?: PluginCache};

export default class BigCalendarPlugin extends Plugin {
  public settings: BigCalendarSettings;

  async onload(): Promise<void> {
    globalService.setPlugin(this);
    await this.loadSettings();
    globalService.setPluginSetting(this.settings);
    await globalService.loadCachedAppSetting();

    this.app.workspace.onLayoutReady(() => {
      fileService.setApp(this.app);
      fileService.initAllFiles();
      void eventService.fetchAllEvents(this.app);
    });

    // Register view and add icons
    this.registerView(CALENDAR_VIEW_TYPE, (leaf) => new BigCalendar(leaf, this));
    addIcons();

    // Add ribbon icon
    this.addRibbonIcon('changeTaskStatus', 'Timeline Calendar', () => {
      new Notice(t('Open big calendar successfully'));
      void this.openCalendar();
    });

    // Add command
    this.addCommand({
      id: 'open-calendar',
      name: t('Open big calendar'),
      callback: () => this.openCalendar(),
    });

    // Add settings tab
    this.addSettingTab(new BigCalendarSettingTab(this.app, this));
  }

  public async loadSettings(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as PluginDataFile;
    // Strip the cache bucket so it never leaks into typed settings.
    const settingsData: Partial<BigCalendarSettings> = {...raw};
    delete (settingsData as PluginDataFile)[CACHE_DATA_KEY];
    this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsData);

    if (this.settings.InsertAfter === '### 今日代办') {
      this.settings.InsertAfter = DEFAULT_SETTINGS.InsertAfter;
    }
    if (this.settings.ProcessEntriesBelow === '### 今日代办') {
      this.settings.ProcessEntriesBelow = DEFAULT_SETTINGS.ProcessEntriesBelow;
    }
    if (this.settings.StartDate === 'Sunday') {
      this.settings.StartDate = DEFAULT_SETTINGS.StartDate;
    }
    this.settings = normalizeVisibleTimeSettings(this.settings);

    globalService.setPluginSetting(this.settings);
  }

  async saveSettings(): Promise<void> {
    this.settings = normalizeVisibleTimeSettings(this.settings);
    globalService.setPluginSetting(this.settings);
    useCalendarStore.getState().setStartDay(this.settings.StartDate === 'monday' ? 'monday' : 'sunday');
    // Preserve any cached view-state when overwriting data.json.
    const existing = ((await this.loadData()) ?? {}) as PluginDataFile;
    const next: PluginDataFile = {...this.settings};
    if (existing[CACHE_DATA_KEY] !== undefined) {
      next[CACHE_DATA_KEY] = existing[CACHE_DATA_KEY];
    }
    await this.saveData(next);
    await this.refreshEventsAfterSettingsChange();
  }

  /**
   * Read the persisted view-state cache stored alongside settings in data.json.
   */
  public async loadCache(): Promise<PluginCache> {
    const raw = ((await this.loadData()) ?? {}) as PluginDataFile;
    const cache = raw[CACHE_DATA_KEY];
    return cache && typeof cache === 'object' ? cache : {};
  }

  /**
   * Persist the view-state cache via the plugin data API, leaving stored
   * settings untouched.
   */
  public async saveCache(cache: PluginCache): Promise<void> {
    const existing = ((await this.loadData()) ?? {}) as PluginDataFile;
    existing[CACHE_DATA_KEY] = cache;
    await this.saveData(existing);
  }

  private async refreshEventsAfterSettingsChange(): Promise<void> {
    try {
      await eventService.fetchAllEvents(this.app);
      useEventStore.getState().setForceUpdate();
    } catch (error) {
      console.error('Failed to refresh events after settings change:', error);
    }
  }

  onunload(): void {
    new Notice(t('Close big calendar successfully'));
  }

  async openCalendar(): Promise<void> {
    const workspace = this.app.workspace;
    const leaf = workspace.getLeavesOfType(CALENDAR_VIEW_TYPE)[0] ?? workspace.getLeaf(false);

    await leaf.setViewState({type: CALENDAR_VIEW_TYPE});
    await workspace.revealLeaf(leaf);
  }
}
