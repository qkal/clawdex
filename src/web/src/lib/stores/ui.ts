import { writable } from "svelte/store";

export const sidebarOpen = writable(true);
export const settingsPanelOpen = writable(false);
export const selectedModel = writable("gpt-4o");
export const autoScroll = writable(true);
