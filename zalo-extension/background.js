let campaignData = [];
let currentIndex = 0;
let isRunning = false;
let zaloTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_CAMPAIGN") {
        campaignData = request.payload || [];
        currentIndex = 0;
        isRunning = true;
        chrome.storage.local.set({ isRunning: true });
        openOrFocusZaloTabAndStart();
    } else if (request.action === "NEXT_PERSON") {
        currentIndex++;
        processNextStudent();
    } else if (request.action === "STOP_CAMPAIGN") {
        isRunning = false;
        chrome.storage.local.set({ isRunning: false, currentTarget: null, campaignProgress: null });
    } else if (request.action === "GET_STATUS") {
        sendResponse({ isRunning, current: currentIndex, total: campaignData.length });
    }
});

function openOrFocusZaloTabAndStart() {
    chrome.tabs.query({ url: "*://chat.zalo.me/*" }, (tabs) => {
        if (tabs && tabs.length > 0) {
            zaloTabId = tabs[0].id;
            chrome.tabs.update(zaloTabId, { active: true }, () => {
                setTimeout(() => {
                    processNextStudent();
                }, 500);
            });
        } else {
            chrome.tabs.create({ url: "https://chat.zalo.me/", active: true }, (newTab) => {
                zaloTabId = newTab.id;
                setTimeout(() => {
                    processNextStudent();
                }, 3500);
            });
        }
    });
}

function processNextStudent() {
    if (!isRunning) return;
    
    if (currentIndex >= campaignData.length) {
        isRunning = false;
        chrome.storage.local.set({ isRunning: false, currentTarget: null, campaignProgress: null });
        if (zaloTabId) {
            chrome.scripting.executeScript({
                target: { tabId: zaloTabId },
                func: () => alert("🎉 ZALO AUTO SENDER: Đã hoàn tất gửi tin nhắn tự động cho tất cả học sinh!")
            }).catch(() => {});
        }
        return;
    }

    const person = campaignData[currentIndex];
    
    // Chuẩn hóa định dạng số điện thoại
    let phone = person.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('84')) {
        phone = '0' + phone.substring(2);
    }
    person.searchPhone = phone;
    
    const progress = { current: currentIndex + 1, total: campaignData.length };

    chrome.storage.local.set({ 
        currentTarget: person,
        campaignProgress: progress
    }, () => {
        if (zaloTabId) {
            chrome.tabs.get(zaloTabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    openOrFocusZaloTabAndStart();
                } else {
                    chrome.tabs.update(zaloTabId, { active: true });
                    setTimeout(() => {
                        chrome.tabs.sendMessage(zaloTabId, { action: "RUN_CURRENT_TARGET" }).catch(() => {});
                    }, 500);
                }
            });
        } else {
            openOrFocusZaloTabAndStart();
        }
    });
}

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === zaloTabId) {
        zaloTabId = null;
        isRunning = false;
        chrome.storage.local.set({ isRunning: false, currentTarget: null, campaignProgress: null });
    }
});
