document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "STOP_CAMPAIGN" });
    document.getElementById('status').innerText = "Đã dừng khẩn cấp!";
    document.getElementById('status').style.background = "#fecaca";
    document.getElementById('status').style.color = "#991b1b";
});

setInterval(() => {
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, (res) => {
        if (res && res.isRunning) {
            document.getElementById('status').innerText = `Đang gửi: ${res.current + 1} / ${res.total}`;
            document.getElementById('status').style.background = "#dcfce7";
            document.getElementById('status').style.color = "#166534";
        } else if (document.getElementById('status').innerText !== "Đã dừng khẩn cấp!") {
            document.getElementById('status').innerText = "Đang rảnh (Hoàn tất)";
            document.getElementById('status').style.background = "#e2e8f0";
            document.getElementById('status').style.color = "#334155";
        }
    });
}, 1000);
