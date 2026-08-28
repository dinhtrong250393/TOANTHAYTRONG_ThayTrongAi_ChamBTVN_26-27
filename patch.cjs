const fs = require('fs');
let code = fs.readFileSync('src/pages/TeacherDashboard.tsx', 'utf8');

const funcCode = `
  const handleZaloNotifyNewTask = async (item, className) => {
    if (!className) return;
    
    // Check if extension is installed
    if (!document.documentElement.getAttribute('data-zalo-extension')) {
        alert("⚠️ CHƯA CÀI ĐẶT TIỆN ÍCH ZALO\\n\\nVui lòng tải thư mục /zalo-extension về máy tính, giải nén (nếu có), vào Chrome -> Tiện ích mở rộng -> Bật Chế độ cho nhà phát triển -> Tải tiện ích đã giải nén -> Chọn thư mục zalo-extension.");
        return;
    }

    try {
      let studs = [];
      const classCoverDoc = await getDoc(doc(db, 'class_students_cover', className));
      if (classCoverDoc.exists()) {
        studs = classCoverDoc.data().students || [];
      } else {
        studs = await syncClassStudentsCover(className) || [];
      }

      if (studs.length === 0) {
        alert('Lớp này chưa có học sinh nào.');
        return;
      }

      const campaignData = [];
      for (const s of studs) {
        if (!s.zalo) continue;
        const msg = \`Chào em: \${s.name}. Hiện tại đã có bài tập mới: \${item.title}. Em đăng nhập để xem nhé!\`;
        campaignData.push({ phone: s.zalo, message: msg });
      }

      triggerZaloCampaign(campaignData);
    } catch (e) {
      console.error(e);
      alert('Lỗi khi lấy danh sách lớp.');
    }
  };
`;

code = code.replace(/const executeNotify = \(\) => {/, funcCode + '\n  const executeNotify = () => {');

// Add button near "Báo bài" for exams
code = code.replace(
  /<button\n\s*onClick={\(\) => {\n\s*setNotifyModalItem\(\{\n\s*id: exam\.id,\n\s*type: 'exam',\n\s*title: exam\.title || 'Bài tập trắc nghiệm',/g,
  `<button
                                          onClick={() => {
                                            if (exam.assignedClasses && exam.assignedClasses.length > 0) {
                                                const cls = prompt("Báo bài mới (Zalo cá nhân)\\nNhập tên lớp (Ví dụ: " + exam.assignedClasses[0] + "):", exam.assignedClasses[0]);
                                                if (cls) {
                                                    handleZaloNotifyNewTask({title: exam.title || 'Bài tập trắc nghiệm'}, cls);
                                                }
                                            } else {
                                                alert("Bài này chưa được giao cho lớp nào.");
                                            }
                                          }}
                                          className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                          title="Báo bài mới (Zalo cá nhân)"
                                        >
                                          <Send className="w-4 h-4 mr-1.5" /> Báo (Zalo)
                                        </button>
                                        <button
                                          onClick={() => {
                                            setNotifyModalItem({
                                              id: exam.id,
                                              type: 'exam',
                                              title: exam.title || 'Bài tập trắc nghiệm',`
);

// Add button near "Báo bài" for essays
code = code.replace(
  /<button\n\s*onClick={\(\) => {\n\s*setNotifyModalItem\(\{\n\s*id: essay\.id,\n\s*type: 'essay',\n\s*title: essay\.title || 'Bài tập tự luận',/g,
  `<button
                                      onClick={() => {
                                        if (essay.assignedClasses && essay.assignedClasses.length > 0) {
                                            const cls = prompt("Báo bài mới (Zalo cá nhân)\\nNhập tên lớp (Ví dụ: " + essay.assignedClasses[0] + "):", essay.assignedClasses[0]);
                                            if (cls) {
                                                handleZaloNotifyNewTask({title: essay.title || 'Bài tập tự luận'}, cls);
                                            }
                                        } else {
                                            alert("Bài này chưa được giao cho lớp nào.");
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                      title="Báo bài mới (Zalo cá nhân)"
                                    >
                                      <Send className="w-4 h-4 mr-1.5" /> Báo (Zalo)
                                    </button>
                                    <button
                                      onClick={() => {
                                        setNotifyModalItem({
                                          id: essay.id,
                                          type: 'essay',
                                          title: essay.title || 'Bài tập tự luận',`
);

fs.writeFileSync('src/pages/TeacherDashboard.tsx', code);
console.log('Patched TeacherDashboard.tsx');
