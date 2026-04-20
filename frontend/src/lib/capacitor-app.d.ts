declare module "@capacitor/app" {
  interface AppLaunchUrl {
    url?: string;
  }

  interface AppUrlOpenEvent {
    url: string;
  }

  interface PluginListenerHandle {
    remove(): Promise<void>;
  }

  interface AppPlugin {
    getLaunchUrl(): Promise<AppLaunchUrl | undefined>;
    addListener(
      eventName: "appUrlOpen",
      listenerFunc: (event: AppUrlOpenEvent) => void
    ): Promise<PluginListenerHandle>;
  }

  export const App: AppPlugin;
}
