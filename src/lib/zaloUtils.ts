export const triggerZaloCampaign = (campaignData: Array<{phone: string, message: string}>) => {
    if (!document.documentElement.getAttribute('data-zalo-extension')) {
        alert("⚠️ CHƯA CÀI ĐẶT TIỆN ÍCH ZALO\n\nVui lòng tải thư mục /zalo-extension về máy tính, giải nén (nếu có), vào Chrome -> Tiện ích mở rộng -> Bật Chế độ cho nhà phát triển -> Tải tiện ích đã giải nén -> Chọn thư mục zalo-extension.");
        return;
    }

    if (campaignData.length === 0) {
        alert("Không tìm thấy số điện thoại hợp lệ nào để gửi.");
        return;
    }

    const evt = new CustomEvent("START_ZALO_CAMPAIGN", { detail: campaignData });
    window.dispatchEvent(evt);
};
