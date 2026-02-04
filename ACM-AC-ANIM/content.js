const REFRESH_DELAY = 5000;

let isPlaying = false;
let refreshTimer = null;

let videoElement = null;
let videoUrl = null;

async function getVideoUrl() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getVideoUrl" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("获取视频 URL 失败:", chrome.runtime.lastError);
                resolve(null);
            } else {
                resolve(response.videoUrl);
            }
        });
    });
}

async function playCelebrationVideo() {
    if (isPlaying) return;
    
    try {
        if (!videoUrl) {
            videoUrl = await getVideoUrl();
            if (!videoUrl) {
                console.error("未找到视频文件，请确保 assets/accepted.mp4 存在");
                return;
            }
        }
        
        isPlaying = true;

        videoElement = document.createElement('video');
        videoElement.src = videoUrl;
        videoElement.controls = false;
        videoElement.autoplay = true;
        videoElement.muted = false;
        
        // 全屏覆盖
        videoElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90vw;
            max-height: 90vh;
            z-index: 999999;
            background: black;
            border-radius: 10px;
            box-shadow: 0 0 50px rgb(0, 0, 0);
            display: block;
        `;
        
        // 背景遮罩
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.85);
            z-index: 999998;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        // 关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            z-index: 999999;
            transition: all 0.3s;
        `;
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
            closeBtn.style.transform = 'scale(1.1)';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            closeBtn.style.transform = 'scale(1)';
        };
        closeBtn.onclick = () => {
            cleanupVideo();
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupVideo();
            }
        };
        
        // 播放完毕时清理
        videoElement.onended = cleanupVideo;
        videoElement.onerror = (e) => {
            console.error("视频播放失败:", e);
            cleanupVideo();
        };
        
        // 添加到页面
        overlay.appendChild(videoElement);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
        
        // 阻止页面滚动
        document.body.style.overflow = 'hidden';
        
        // 播放视频
        await videoElement.play();
        
    } catch (error) {
        console.error("播放视频失败:", error);
        isPlaying = false;
        cleanupVideo();
    }
}

// 清理视频相关元素
function cleanupVideo() {
    if (videoElement) {
        videoElement.pause();
        videoElement = null;
    }
    
    const overlay = document.querySelector('div[style*="background: rgba(0, 0, 0, 0.85)"]');
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
    
    // 恢复页面滚动
    document.body.style.overflow = '';
    isPlaying = false;
}

// 监听
function checkCFSubmission() {
    const headerUserLink = document.querySelector('.lang-chooser div a[href^="/profile/"]');
    if (!headerUserLink) return;
    const myProfileHref = headerUserLink.getAttribute('href');
    
    const rows = document.querySelectorAll('table.status-frame-datatable tr[data-submission-id]');
    let myLatestRow = null;
    
    for (let row of rows) {
        const profileLink = row.querySelector(`td.status-party-cell a[href="${myProfileHref}"]`);
        if (profileLink) {
            myLatestRow = row;
            break;
        }
    }
    
    if (myLatestRow) {
        const statusCell = myLatestRow.querySelector('td.status-verdict-cell');
        if (!statusCell) return;
        
        const isWaiting = statusCell.getAttribute('waiting') === 'true';
        const submissionID = myLatestRow.getAttribute('data-submission-id');
        const lastPlayedID = sessionStorage.getItem('cf_ac_video_last_played_id');
        
        if (isWaiting) {
            console.log("CF: 检测到测评中，5秒后刷新...");
            if (!refreshTimer) {
                refreshTimer = setTimeout(() => {
                    refreshTimer = null;
                    location.reload();
                }, REFRESH_DELAY);
            }
        } else {
            // 评测结束
            if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
            }
            
            let isAccepted = false;
            
            const verdictWrapper = myLatestRow.querySelector('.submissionVerdictWrapper');
            if (verdictWrapper) {
                isAccepted = verdictWrapper.querySelector('.verdict-accepted') !== null;
            } else {
                isAccepted = statusCell.querySelector('.verdict-accepted') !== null;
            }
            
            if (isAccepted) {
                if (submissionID !== lastPlayedID) {
                    sessionStorage.setItem('cf_ac_video_last_played_id', submissionID);
                    console.log("CF: AC! ID:", submissionID);
                    
                    playCelebrationVideo();
                }
            } else {
                console.log("CF: 评测结束但未AC，停止刷新");
            }
        }
    }
}

// 初始化函数
function initACAnimation() {
    console.log("AC ANIM 插件已加载");
    
    const isSubmissionPage = window.location.href.includes('/submissions') || 
                           window.location.href.includes('/problem/') ||
                           window.location.href.includes('/contest/');
    
    if (isSubmissionPage) {
        setTimeout(checkCFSubmission, 1000);

        const checkInterval = setInterval(checkCFSubmission, 500);
        
        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            clearInterval(checkInterval);
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }
            cleanupVideo();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initACAnimation);
} else {
    initACAnimation();
}

let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(initACAnimation, 1000);
    }
}).observe(document, { subtree: true, childList: true });