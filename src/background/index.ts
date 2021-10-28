const MAX_TAB_COUNT = 20;
const TAB_DATA_KEY = "tab_data";
let all_tabs: { title: string, url: string, window_id?: number, tab_id?: number }[] = [];
let auto_removed_tabs = [];

function tab_open(tab) {
    console.log("tab_open all_tabs", all_tabs, tab);
    for (let i = all_tabs.length - 1; i >= 0; i--) {
        if (all_tabs[i].url !== tab.url) continue;
        if (all_tabs[i].window_id === undefined) {
            let [current] = all_tabs.splice(i, 1);
            console.log("current", current);
            current.window_id = tab.windowId;
            current.tab_id = tab.id;
            all_tabs.push(current);
            return;
        }
    }
    all_tabs.push({url: tab.url, title: tab.title, window_id: tab.windowId, tab_id: tab.id});
    chrome.windows.get(tab.windowId, {populate: true}, window => {
        console.debug(window);
        console.debug(window.tabs);
        if (window.tabs.length <= MAX_TAB_COUNT) return;
        let tabs = [...window.tabs];
        tabs.sort((a, b) => {
            for (let i = all_tabs.length - 1; i >= 0; i--) {
                if (all_tabs[i].tab_id === a.id) return -1;
                if (all_tabs[i].tab_id === b.id) return 1;
            }
            return 0;
        });
        console.debug(tabs);
        console.debug(all_tabs);
        for (let tab of tabs.slice(MAX_TAB_COUNT)) {
            auto_removed_tabs.push(tab.id);
            chrome.tabs.remove(tab.id);
            let index = all_tabs.findIndex(({tab_id}) => tab_id === tab.id);
            console.debug(index);
            all_tabs[index].window_id = undefined;
            all_tabs[index].tab_id = undefined;
        }
    });
}

(async () => {
    let {tab_data} = await new Promise(resolve => chrome.storage.local.get(TAB_DATA_KEY, resolve));
    if (Array.isArray(tab_data)) all_tabs = all_tabs.concat(tab_data.map(({title, url}) => {
        return {title, url};
    }));
    let all_windows = await new Promise(resolve => chrome.windows.getAll(resolve));
    console.debug(all_windows);
    console.log("all_windows", all_windows);
    for (let window of all_windows) {
        console.log("window", window);
        chrome.windows.get(window.id, {populate: true, windowTypes: ['normal']}, (window) => {
            if (window === undefined) return;
            console.log("window", window);
            for (let tab of window.tabs) {
                console.log("tab", tab);
                tab_open(tab);
            }
        });
    }
})();

chrome.windows.onCreated.addListener((window, filters) => console.log("window created", window, filters));
chrome.tabs.onActivated.addListener(activeInfo => {
    let index = all_tabs.findIndex(({tab_id}) => tab_id === activeInfo.tabId);
    let [current] = all_tabs.splice(index, 1);
    all_tabs.push(current);
    console.log("tab activated", activeInfo)
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    let index = all_tabs.findIndex(({tab_id}) => tab_id == tabId);
    let [current] = all_tabs.splice(index, 1);
    if (changeInfo.url !== undefined) current.url = changeInfo.url;
    if (changeInfo.title !== undefined) current.title = changeInfo.title;
    all_tabs.push(current);
    console.log("all_tabs", all_tabs);
    console.log("tab updated", tabId, changeInfo, tab)
});
chrome.tabs.onMoved.addListener((tabId, moveInfo) => console.log("tab moved", tabId, moveInfo));
chrome.tabs.onCreated.addListener(tab_open);
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    let index = auto_removed_tabs.indexOf(tabId);
    if (index >= 0) {
        auto_removed_tabs.splice(index, 1);
        return;
    }
    index = all_tabs.findIndex(({tab_id}) => tab_id === tabId);
    all_tabs.splice(index, 1);
    console.log("all_tabs.length", all_tabs.length);
    if (removeInfo.isWindowClosing) return;
    chrome.windows.get(removeInfo.windowId, {populate: true}, window => {
        if (window === undefined) return;
        if (window.tabs.length >= MAX_TAB_COUNT) return;
        let j = all_tabs.length - 1;
        for (let i = 0; i < MAX_TAB_COUNT - window.tabs.length; i++) {
            for (; j >= 0; j--) {
                if (all_tabs[j].tab_id === undefined) {
                    let [t] = all_tabs.splice(j, 1);
                    chrome.tabs.create({windowId: removeInfo.windowId, url: t.url, active: false});
                    break;
                }
            }
            j--;
        }
    });
    console.log("tab removed", tabId, removeInfo, all_tabs);
})
chrome.runtime.onInstalled.addListener((reason) => {
    console.log(reason);
});

chrome.runtime.onMessage.addListener(message => {
    console.log(message);
    if ("move" in message) {
        const index = message.move;
        const [tab] = all_tabs.splice(index, 1);
        chrome.windows.getCurrent(window => chrome.tabs.create({windowId: window.id, url: tab.url, active: true}));
    }
    if ("remove" in message) {
        const index = message.remove;
        all_tabs.splice(index, 1);
    }
})

setInterval(() => {
    chrome.storage.local.set({tab_data: all_tabs});
}, 500);