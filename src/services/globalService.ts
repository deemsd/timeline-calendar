import {BigCalendarSettings} from '@/setting';
import type BigCalendarPlugin from '@/index';
import useGlobalStateStore, {AppSetting} from '@/stores/globalStateStore';

const APP_SETTING_KEYS = ['shouldHideImageUrl', 'shouldUseMarkdownParser'] as const satisfies readonly (keyof AppSetting)[];

class GlobalService {
  private plugin: BigCalendarPlugin | null = null;

  /**
   * Register the plugin instance. Must be called before any cache I/O so that
   * we can route persistence through the Obsidian plugin data API instead of
   * browser-managed storage.
   */
  public setPlugin(plugin: BigCalendarPlugin): void {
    this.plugin = plugin;
  }

  public getPlugin(): BigCalendarPlugin | null {
    return this.plugin;
  }

  /**
   * Load the cached AppSetting flags
   * from the plugin data file and apply them to the global state store.
   * Safe to call multiple times.
   */
  public async loadCachedAppSetting(): Promise<void> {
    if (!this.plugin) return;
    const defaultAppSetting: AppSetting = {
      shouldHideImageUrl: true,
      shouldUseMarkdownParser: true,
    };

    try {
      const cache = await this.plugin.loadCache();
      for (const key of APP_SETTING_KEYS) {
        const value = cache[key];
        if (typeof value === 'boolean') {
          defaultAppSetting[key] = value;
        }
      }
    } catch (error) {
      console.error('Failed to load cached app settings:', error);
    }

    useGlobalStateStore.getState().setAppSetting(defaultAppSetting);
  }

  public getState = () => {
    return useGlobalStateStore.getState();
  };

  public setEditEventId = (editEventId: string) => {
    useGlobalStateStore.getState().setEditEventId(editEventId);
  };

  public setMarkEventId = (markEventId: string) => {
    useGlobalStateStore.getState().setMarkEventId(markEventId);
  };

  public setIsMobileView = (isMobileView: boolean) => {
    useGlobalStateStore.getState().setMobileView(isMobileView);
  };

  public setShowSiderbarInMobileView = (showSiderbarInMobileView: boolean) => {
    useGlobalStateStore.getState().setShowSiderbarInMobileView(showSiderbarInMobileView);
  };

  public setAppSetting = (appSetting: Partial<AppSetting>): void => {
    useGlobalStateStore.getState().setAppSetting(appSetting);
    void this.persistAppSetting(appSetting);
  };

  public setPluginSetting = (pluginSetting: BigCalendarSettings) => {
    useGlobalStateStore.getState().setPluginSetting(pluginSetting);
  };

  private async persistAppSetting(appSetting: Partial<AppSetting>): Promise<void> {
    if (!this.plugin) return;
    try {
      const cache = await this.plugin.loadCache();
      for (const key of APP_SETTING_KEYS) {
        if (appSetting[key] !== undefined) {
          cache[key] = appSetting[key];
        }
      }
      await this.plugin.saveCache(cache);
    } catch (error) {
      console.error('Failed to persist app settings:', error);
    }
  }
}

const globalService = new GlobalService();

export default globalService;
