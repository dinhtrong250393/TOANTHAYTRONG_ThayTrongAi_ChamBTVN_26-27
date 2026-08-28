// Zalo Auto Sender - Content Script for chat.zalo.me

let isCurrentlyWorking = false;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Chờ 1 phần tử xuất hiện trong DOM
async function waitForElement(finderFn, timeoutMs = 20000, intervalMs = 300) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        try {
            const el = finderFn();
            if (el && (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0)) {
                return el;
            }
        } catch (e) {}
        await sleep(intervalMs);
    }
    return null;
}

// Bảng thông báo trạng thái trực quan trên góc màn hình Zalo
function updateStatusBadge(text, isError = false) {
    let badge = document.getElementById('zalo-auto-sender-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'zalo-auto-sender-badge';
        badge.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 9999999;
            background: #0f172a;
            color: #f8fafc;
            padding: 14px 20px;
            border-radius: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 12px 30px rgba(0,0,0,0.4);
            border: 2px solid #3b82f6;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 420px;
            line-height: 1.5;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(badge);
    }
    badge.style.borderColor = isError ? '#ef4444' : '#3b82f6';
    badge.innerHTML = `
        <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${isError ? '#ef4444' : '#22c55e'}; flex-shrink:0;"></span>
        <div style="flex:1;">
            <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:0.5px; font-weight:700;">Zalo Auto Sender</div>
            <div style="color:#ffffff; margin-top:2px;">${text}</div>
        </div>
    `;
}

// 1. Tìm ô tìm kiếm
function findSearchInput() {
    return document.querySelector('#contact-search-input') ||
           document.querySelector('input[data-translate-placeholder="STR_SEARCH"]') ||
           document.querySelector('input[placeholder*="Tìm kiếm"]') ||
           document.querySelector('input[placeholder*="Search"]') ||
           document.querySelector('[data-id="div_SearchNav"] input') ||
           document.querySelector('.search-input');
}

// 2. Tìm nút "Nhắn tin" trên bảng Popup Profile (nếu có)
function findProfileMessageButton() {
    const all = Array.from(document.querySelectorAll('button, div, span, a'));
    for (const el of all) {
        const text = (el.textContent || '').trim().toLowerCase();
        if ((text === 'nhắn tin' || text === 'gửi tin nhắn' || text === 'message') && el.offsetParent !== null) {
            // Đảm bảo là nút bấm trong modal
            if (el.tagName.toLowerCase() === 'button' || el.children.length === 0 || el.classList.contains('btn')) {
                return el;
            }
        }
    }
    return null;
}

// 3. Tìm ô nhập tin nhắn (Khung chat chính)
function findChatEditor() {
    return document.querySelector('#richInput') ||
           document.querySelector('div[contenteditable="true"]#richInput') ||
           document.querySelector('div[contenteditable="true"][data-translate-placeholder*="STR_INPUT"]') ||
           document.querySelector('.chat-input-editor') ||
           document.querySelector('div[contenteditable="true"]');
}

// Bơm số vào ô tìm kiếm an toàn (Chỉ gõ 1 lần duy nhất)
function fillSearchInput(inputEl, text) {
    inputEl.focus();
    inputEl.click();
    
    // Xóa sạch text cũ
    inputEl.value = '';
    const tracker = inputEl._valueTracker;
    if (tracker) tracker.setValue('temp');
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Gán giá trị mới
    inputEl.value = text;
    if (tracker) tracker.setValue('');
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
}

// Gõ văn bản vào khung chat Zalo
async function writeMessageToEditor(editorEl, text) {
    editorEl.focus();
    editorEl.click();
    await sleep(200);

    // Xóa sạch nội dung cũ nếu có
    editorEl.innerHTML = '';
    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);

    // Dùng execCommand để gõ đúng chuẩn HTML contenteditable
    const lines = text.split('\n');
    for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        if (line.length > 0) {
            document.execCommand('insertText', false, line);
            await sleep(30);
        }
        if (l < lines.length - 1) {
            document.execCommand('insertLineBreak', false, null);
            await sleep(50);
        }
    }
    
    editorEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    await sleep(400);
}

// Bấm gửi tin nhắn (Bằng phím Enter và Nút Gửi Zalo)
async function submitChatMessage(editorEl) {
    editorEl.focus();
    
    // 1. Dispatch phím Enter
    const enterDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    });
    editorEl.dispatchEvent(enterDown);

    const enterUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    });
    editorEl.dispatchEvent(enterUp);

    await sleep(300);

    // 2. Tìm nút Gửi (icon máy bay giấy) bấm bổ sung để chắc chắn 100%
    const sendBtn = document.querySelector('[data-id="btn_SendMsg"]') ||
                    document.querySelector('.btn-send') ||
                    document.querySelector('div[title*="Gửi"]') ||
                    document.querySelector('div[data-translate-title="STR_SEND_MSG"]');
    if (sendBtn && sendBtn.offsetParent !== null) {
        sendBtn.click();
    }
}

// QUY TRÌNH XỬ LÝ 1 HỌC SINH
async function processCurrentStudent() {
    if (isCurrentlyWorking) return;

    const data = await chrome.storage.local.get(['isRunning', 'currentTarget', 'campaignProgress']);
    if (!data.isRunning || !data.currentTarget) {
        return;
    }

    isCurrentlyWorking = true;
    const student = data.currentTarget;
    const progressText = data.campaignProgress ? ` (${data.campaignProgress.current}/${data.campaignProgress.total})` : '';

    try {
        updateStatusBadge(`Đang chuẩn bị Zalo...${progressText}`);

        // BƯỚC 1: Chờ và tìm ô Tìm kiếm
        const searchInput = await waitForElement(findSearchInput, 25000);
        if (!searchInput) {
            throw new Error("Không thấy ô Tìm kiếm. Vui lòng đăng nhập Zalo Web sẵn sàng!");
        }

        // BƯỚC 2: Nhập số điện thoại vào ô Tìm kiếm (ĐÚNG 1 LẦN)
        updateStatusBadge(`Đang tìm kiếm SĐT: <b>${student.searchPhone}</b>${progressText}`);
        fillSearchInput(searchInput, student.searchPhone);
        
        // Đợi Zalo quét tìm kiếm danh bạ / số lạ (khoảng 2.5s)
        await sleep(2500);

        // BƯỚC 3: Chọn kết quả tìm kiếm
        // Thử click vào dòng kết quả đầu tiên xuất hiện trong danh sách tìm kiếm
        const firstSearchResult = document.querySelector('.conv-item') ||
                                  document.querySelector('.search-list-item') ||
                                  document.querySelector('[data-id="div_SearchResultItem"]') ||
                                  document.querySelector('.list-friend-item') ||
                                  document.querySelector('.search-item');
        
        if (firstSearchResult && firstSearchResult.offsetParent !== null) {
            firstSearchResult.click();
        } else {
            // Hoặc nhấn Enter trên ô tìm kiếm
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }

        await sleep(1500);

        // BƯỚC 4: Nếu bị vướng bảng popup "Thông tin tài khoản", bấm nút "Nhắn tin"
        const modalMsgBtn = await waitForElement(findProfileMessageButton, 2500);
        if (modalMsgBtn) {
            updateStatusBadge(`Đang bấm nút "Nhắn tin" trên bảng tài khoản...`);
            modalMsgBtn.click();
            await sleep(1500);
        }

        // Rút tiêu điểm (blur) khỏi ô tìm kiếm để tránh gõ nhầm tin nhắn vào ô tìm kiếm!
        searchInput.blur();
        await sleep(500);

        // BƯỚC 5: Chờ ô soạn thảo tin nhắn (Khung Chat) xuất hiện
        updateStatusBadge(`Đang mở khung soạn thảo tin nhắn...`);
        const chatEditor = await waitForElement(findChatEditor, 10000);
        if (!chatEditor) {
            throw new Error(`Không mở được khung chat với SĐT ${student.searchPhone} (có thể số này chưa đăng ký Zalo).`);
        }

        // BƯỚC 6: Gõ tin nhắn vào Ô NHẬP TIN NHẮN (Không phải ô tìm kiếm)
        updateStatusBadge(`Đang gõ tin nhắn cho <b>${student.searchPhone}</b>...`);
        const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
        const fullMessage = `${student.message}\n[Mã: ${hash}]`;
        
        await writeMessageToEditor(chatEditor, fullMessage);
        await sleep(1000);

        // BƯỚC 7: Nhấn ENTER gửi tin nhắn
        updateStatusBadge(`Đang gửi tin nhắn đi...`);
        await submitChatMessage(chatEditor);
        await sleep(1500);

        // BƯỚC 8: Nghỉ ngơi an toàn chống chặn Zalo (7 đến 10 giây)
        const waitTimeSec = Math.floor(Math.random() * 4) + 7;
        for (let s = waitTimeSec; s > 0; s--) {
            updateStatusBadge(`✅ Đã gửi xong cho ${student.searchPhone}! Nghỉ an toàn: <b>${s}s</b>...${progressText}`);
            await sleep(1000);
        }

        // BƯỚC 9: Dọn dẹp ô tìm kiếm và chuyển sang em tiếp theo
        const clearSearchBtn = document.querySelector('#contact-search-clear-btn') || 
                               document.querySelector('.icon-clear') || 
                               document.querySelector('.fa-close');
        if (clearSearchBtn) clearSearchBtn.click();

        await chrome.storage.local.remove(['currentTarget']);
        isCurrentlyWorking = false;
        chrome.runtime.sendMessage({ action: "NEXT_PERSON" });

    } catch (err) {
        console.warn("Zalo Auto Sender:", err.message);
        updateStatusBadge(`⚠️ ${err.message}`, true);
        await sleep(3500);
        await chrome.storage.local.remove(['currentTarget']);
        isCurrentlyWorking = false;
        chrome.runtime.sendMessage({ action: "NEXT_PERSON" });
    }
}

// Lắng nghe lệnh từ background script
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "RUN_CURRENT_TARGET") {
        processCurrentStudent();
    }
});

// Chạy tự động nếu đang có tiến trình chờ khi reload tab
processCurrentStudent();
