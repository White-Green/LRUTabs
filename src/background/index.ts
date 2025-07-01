const MAX_TAB_COUNT = 20;
const TAB_DATA_KEY = 'tab_data';

interface TabInfo {
  title: string;
  url: string;
  window_id?: number;
  tab_id?: number;
}

let allTabs: TabInfo[] = [];
let autoRemoved: number[] = [];

function saveTabs() {
  chrome.storage.local.set({ [TAB_DATA_KEY]: allTabs });
}

function handleTabOpen(tab: chrome.tabs.Tab) {
  for (let i = allTabs.length - 1; i >= 0; i--) {
    if (allTabs[i].url !== tab.url) continue;
    if (allTabs[i].window_id === undefined) {
      allTabs[i].window_id = tab.windowId;
      allTabs[i].tab_id = tab.id;
      if (tab.active) {
        const [cur] = allTabs.splice(i, 1);
        allTabs.push(cur);
      }
      saveTabs();
      return;
    }
  }

  allTabs.push({ url: tab.url!, title: tab.title || tab.url!, window_id: tab.windowId, tab_id: tab.id });
  chrome.windows.get(tab.windowId, { populate: true }, window => {
    if (!window?.tabs) return;
    if (window.tabs.length <= MAX_TAB_COUNT) return;
    const tabs = [...window.tabs];
    tabs.sort((a, b) => {
      for (let i = allTabs.length - 1; i >= 0; i--) {
        if (allTabs[i].tab_id === a.id) return -1;
        if (allTabs[i].tab_id === b.id) return 1;
      }
      return 0;
    });
    for (const t of tabs.slice(MAX_TAB_COUNT)) {
      autoRemoved.push(t.id!);
      chrome.tabs.remove(t.id!);
      const index = allTabs.findIndex(({ tab_id }) => tab_id === t.id);
      if (index >= 0) {
        allTabs[index].window_id = undefined;
        allTabs[index].tab_id = undefined;
      }
    }
    saveTabs();
  });
}

async function init() {
  const { [TAB_DATA_KEY]: tabData } = await chrome.storage.local.get(TAB_DATA_KEY);
  if (Array.isArray(tabData)) {
    allTabs = tabData.map(({ title, url }: TabInfo) => ({ title, url }));
  }
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
  for (const win of windows) {
    for (const tab of win.tabs || []) {
      handleTabOpen(tab);
    }
  }
  saveTabs();
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
init();

chrome.tabs.onActivated.addListener(activeInfo => {
  const index = allTabs.findIndex(({ tab_id }) => tab_id === activeInfo.tabId);
  if (index >= 0) {
    const [cur] = allTabs.splice(index, 1);
    allTabs.push(cur);
    saveTabs();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  let index = allTabs.findIndex(({ tab_id }) => tab_id === tabId);
  if (index >= 0) {
    if (changeInfo.url !== undefined) allTabs[index].url = changeInfo.url;
    if (changeInfo.title !== undefined) allTabs[index].title = changeInfo.title!;
  } else {
    const current: TabInfo = { url: changeInfo.url || '', title: changeInfo.title || '', tab_id: tab.id, window_id: tab.windowId };
    allTabs.push(current);
  }
  saveTabs();
});

chrome.tabs.onCreated.addListener(handleTabOpen);

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const idx = autoRemoved.indexOf(tabId);
  if (idx >= 0) {
    autoRemoved.splice(idx, 1);
    return;
  }
  const index = allTabs.findIndex(t => t.tab_id === tabId);
  if (index >= 0) allTabs.splice(index, 1);
  saveTabs();
});

chrome.runtime.onMessage.addListener(message => {
  if ('move' in message) {
    const index = message.move as number;
    const [tab] = allTabs.splice(index, 1);
    chrome.windows.getCurrent(window => {
      chrome.tabs.create({ windowId: window.id, url: tab.url, active: true });
    });
    saveTabs();
  }
  if ('remove' in message) {
    const index = message.remove as number;
    allTabs.splice(index, 1);
    saveTabs();
  }
});

export {}; // ensure this file is treated as a module
