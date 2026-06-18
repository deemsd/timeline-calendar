import {App, PluginSettingTab, Setting} from 'obsidian';
import type BigCalendar from './index';
import {t} from './translations/helper';
import '@/less/setting.less';

export interface BigCalendarSettings {
  StartDate: string;
  InsertAfter: string;
  DefaultEventComposition: string;
  ProcessEntriesBelow: string;
  VisibleStartTime: string;
  VisibleEndTime: string;
  DailyNoteCreateBaseFolder: string;
  DailyNoteCreateYearFormat: string;
  DailyNoteCreateMonthFormat: string;
}

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_SETTINGS: BigCalendarSettings = {
  StartDate: 'sunday',
  InsertAfter: '### 今日任务',
  ProcessEntriesBelow: '### 今日任务',
  DefaultEventComposition: '{TIME} {CONTENT}',
  VisibleStartTime: '08:00',
  VisibleEndTime: '21:00',
  DailyNoteCreateBaseFolder: '',
  DailyNoteCreateYearFormat: 'YYYY',
  DailyNoteCreateMonthFormat: 'YYYY-MM',
};

export const isClockTime = (value: string): boolean => CLOCK_TIME_PATTERN.test(value);

export const clockTimeToMinutes = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

export const normalizeVisibleTimeSettings = (settings: BigCalendarSettings): BigCalendarSettings => {
  const nextSettings = {...settings};

  if (!isClockTime(nextSettings.VisibleStartTime)) {
    nextSettings.VisibleStartTime = DEFAULT_SETTINGS.VisibleStartTime;
  }

  if (!isClockTime(nextSettings.VisibleEndTime)) {
    nextSettings.VisibleEndTime = DEFAULT_SETTINGS.VisibleEndTime;
  }

  if (clockTimeToMinutes(nextSettings.VisibleStartTime) >= clockTimeToMinutes(nextSettings.VisibleEndTime)) {
    nextSettings.VisibleStartTime = DEFAULT_SETTINGS.VisibleStartTime;
    nextSettings.VisibleEndTime = DEFAULT_SETTINGS.VisibleEndTime;
  }

  nextSettings.DailyNoteCreateBaseFolder = (nextSettings.DailyNoteCreateBaseFolder || '').trim();
  nextSettings.DailyNoteCreateYearFormat =
    (nextSettings.DailyNoteCreateYearFormat || '').trim() || DEFAULT_SETTINGS.DailyNoteCreateYearFormat;
  nextSettings.DailyNoteCreateMonthFormat =
    (nextSettings.DailyNoteCreateMonthFormat || '').trim() || DEFAULT_SETTINGS.DailyNoteCreateMonthFormat;

  return nextSettings;
};

export class BigCalendarSettingTab extends PluginSettingTab {
  plugin: BigCalendar;
  private applyDebounceTimer = 0;

  constructor(app: App, plugin: BigCalendar) {
    super(app, plugin);
    this.plugin = plugin;
  }

  applySettingsUpdate(): void {
    window.clearTimeout(this.applyDebounceTimer);
    const plugin = this.plugin;
    this.applyDebounceTimer = window.setTimeout(() => {
      void plugin.saveSettings();
    }, 300);
  }

  display(): void {
    void this.plugin.loadSettings();

    const {containerEl} = this;
    this.containerEl.empty();

    new Setting(containerEl).setHeading().setName(t('Regular Options'));

    new Setting(containerEl)
      .setName(t('First Day of Week'))
      .setDesc(t('Choose the first day of the week. Sunday is the default.'))
      .addDropdown((dropdown) =>
        dropdown
          .addOption('sunday', t('Sunday'))
          .addOption('monday', t('Monday'))
          .setValue(this.plugin.settings.StartDate)
          .onChange(async (value) => {
            this.plugin.settings.StartDate = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t('Insert after heading'))
      .setDesc(
        t('You should set the same heading below if you want to insert and process events below the same heading.'),
      )
      .addText((text) =>
        text
          .setPlaceholder('# JOURNAL')
          .setValue(this.plugin.settings.InsertAfter)
          .onChange(async (value) => {
            this.plugin.settings.InsertAfter = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t('Process Events below'))
      .setDesc(
        t(
          'Only entries below this string/section in your notes will be processed. If it does not exist no notes will be processed for that file.',
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.ProcessEntriesBelow)
          .setValue(this.plugin.settings.ProcessEntriesBelow)
          .onChange(async (value) => {
            this.plugin.settings.ProcessEntriesBelow = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t('Visible start time'))
      .setDesc(t('Earliest time shown in week and day views.'))
      .addText((text) => {
        text.inputEl.type = 'time';
        text
          .setValue(this.plugin.settings.VisibleStartTime)
          .onChange(async (value) => {
            this.plugin.settings.VisibleStartTime = value || DEFAULT_SETTINGS.VisibleStartTime;
            this.applySettingsUpdate();
          });
      });

    new Setting(containerEl)
      .setName(t('Visible end time'))
      .setDesc(t('Latest time shown in week and day views.'))
      .addText((text) => {
        text.inputEl.type = 'time';
        text
          .setValue(this.plugin.settings.VisibleEndTime)
          .onChange(async (value) => {
            this.plugin.settings.VisibleEndTime = value || DEFAULT_SETTINGS.VisibleEndTime;
            this.applySettingsUpdate();
          });
      });

    new Setting(containerEl).setHeading().setName(t('Daily note creation'));

    new Setting(containerEl)
      .setName(t('Daily note base folder'))
      .setDesc(t('Folder where new daily notes are created. Leave empty to use the Obsidian daily notes folder.'))
      .addText((text) =>
        text
          .setPlaceholder('01-个人事务/1.8-每日记录')
          .setValue(this.plugin.settings.DailyNoteCreateBaseFolder)
          .onChange(async (value) => {
            this.plugin.settings.DailyNoteCreateBaseFolder = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t('Year folder format'))
      .setDesc(t('Moment format for the year folder under the base folder.'))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.DailyNoteCreateYearFormat)
          .setValue(this.plugin.settings.DailyNoteCreateYearFormat)
          .onChange(async (value) => {
            this.plugin.settings.DailyNoteCreateYearFormat = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t('Month folder format'))
      .setDesc(t('Moment format for the month folder under the year folder.'))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.DailyNoteCreateMonthFormat)
          .setValue(this.plugin.settings.DailyNoteCreateMonthFormat)
          .onChange(async (value) => {
            this.plugin.settings.DailyNoteCreateMonthFormat = value;
            this.applySettingsUpdate();
          }),
      );
  }
}
