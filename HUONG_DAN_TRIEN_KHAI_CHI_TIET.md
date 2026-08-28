# 📘 HƯỚNG DẪN TRIỂN KHAI VÀ SỬ DỤNG HỆ THỐNG DÀNH CHO GIÁO VIÊN

Chào mừng Thầy/Cô đã nhận bộ mã nguồn hệ thống quản lý kiểm tra, thi trắc nghiệm & tự luận thông minh (tích hợp chấm điểm AI Gemini, Zalo Extension tự động báo điểm cho phụ huynh)!

---

## 🚀 CÁCH 1: TRIỂN KHAI TRÊN GOOGLE AI STUDIO BUILD (NHANH NHẤT & DỄ NHẤT)
1. Truy cập **[Google AI Studio Build](https://ai.studio/build)**.
2. Chọn **Import Project** (hoặc kéo thả toàn bộ thư mục/file .zip này lên).
3. Hệ thống AI Studio sẽ tự động tạo dự án Firebase riêng biệt của Thầy/Cô và tự động cấu hình .
4. Cung cấp API Key Gemini: Vào mục **Settings / Secrets** -> Thêm  (Lấy miễn phí tại: https://aistudio.google.com/app/apikey).
5. Ứng dụng sẽ hoạt động ngay lập tức 100%!

---

## 🌐 CÁCH 2: ĐƯA LÊN GITHUB VÀ TRIỂN KHAI TRÊN VERCEL (HOẶC CLOUD RUN)
### Bước 1: Đẩy mã nguồn lên GitHub cá nhân
1. Đăng nhập tài khoản GitHub, tạo Repository mới (ví dụ: ).
2. Tải toàn bộ thư mục mã nguồn này lên GitHub (sử dụng GitHub Desktop hoặc Git command: Initialized empty Git repository in /app/applet/.git/, , , ).

### Bước 2: Tạo Firebase Database riêng của Thầy/Cô
1. Truy cập **[Firebase Console](https://console.firebase.google.com)** -> Tạo Project mới.
2. Bật dịch vụ **Authentication** (cho phép Email/Password và Anonymous nếu cần).
3. Bật **Firestore Database** (chọn chế độ Production hoặc Test mode).
4. Vào **Project Settings** -> Thêm ứng dụng Web -> Sao chép thông số cấu hình Firebase và dán vào file .

### Bước 3: Cấu hình Kho lưu ảnh Cloudinary (Miễn phí)
1. Đăng ký tài khoản tại **[Cloudinary](https://cloudinary.com)**.
2. Lấy **Cloud Name** trên Dashboard.
3. Vào mục **Settings > Upload > Upload presets** -> Bấm **Add upload preset** -> Chọn **Signing Mode: Unsigned** -> Đặt tên preset (ví dụ: ) -> Bấm Lưu.

### Bước 4: Triển khai lên Vercel
1. Đăng nhập **[Vercel](https://vercel.com)** -> Bấm **Add New Project** -> Chọn GitHub Repository vừa tạo.
2. Trong mục **Environment Variables**, thêm các biến:
   - : Khóa Gemini API của Thầy/Cô.
   - : Cloud Name Cloudinary của Thầy/Cô.
   - : Upload preset Cloudinary vừa tạo.
3. Bấm **Deploy**. Sau 1-2 phút, Thầy/Cô sẽ có link website hoạt động 24/7!

---

## 💬 HƯỚNG DẪN CÀI ĐẶT TIỆN ÍCH ZALO EXTENSION (TỰ ĐỘNG GỬI TIN PHỤ HUYNH)
1. Mở trình duyệt Chrome/Cốc Cốc/Edge, truy cập đường dẫn: .
2. Bật chế độ **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
3. Bấm nút **Load unpacked** (Tải tiện ích đã giải nén) -> Chọn thư mục  có trong bộ mã nguồn này.
4. Mở tab **Zalo Web** (https://chat.zalo.me) và đăng nhập Zalo của Thầy/Cô.
5. Khi Thầy/Cô xuất chiến dịch gửi tin báo điểm trên website, tiện ích sẽ tự động kết nối và gửi tin nhắn chuẩn mực tới từng phụ huynh/học sinh!
