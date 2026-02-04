chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getVideoUrl") {
        const videoUrl = chrome.runtime.getURL('assets/accepted.mp4');
        sendResponse({ videoUrl });
    }
    return false;
});