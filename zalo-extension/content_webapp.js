// Đánh dấu Web App biết là Extension đã được cài đặt
document.documentElement.setAttribute('data-zalo-extension', 'true');

window.addEventListener("START_ZALO_CAMPAIGN", (event) => {
    const data = event.detail;
    if (!data || data.length === 0) return;
    
    chrome.runtime.sendMessage({ action: "START_CAMPAIGN", payload: data });
    alert(`Đã nhận lệnh gửi Zalo cho ${data.length} học sinh.\nTiện ích sẽ tự động mở 1 tab Zalo và bắt đầu chạy.\nVui lòng KHÔNG đóng tab Zalo đó cho đến khi hoàn tất!`);
});
