const fs = require('fs');
let code = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');

// Imports
code = code.replace(
  /import { db, handleFirestoreError, OperationType } from '\.\.\/lib\/firebase';/,
  `import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { triggerZaloCampaign } from '../lib/zaloUtils';`
);

// Functions inside EssayResults
const funcs = `
  const notifyScoreZalo = () => {
    if (!essay) return;
    const gradedSubs = submissions.filter(s => s.status === 'graded');
    if (gradedSubs.length === 0) {
      alert("Chưa có học sinh nào được chấm điểm.");
      return;
    }
    const campaignData = [];
    for (const sub of gradedSubs) {
      const student = students.find(s => s.uid === sub.studentId);
      const zalo = sub.studentZalo || (student && student.zalo) || null;
      if (!zalo) continue;
      const msg = \`Chào em: \${sub.studentName}. Hiện tại đã có điểm bài: \${essay.title || 'Bài tập tự luận'}. Điểm của em: \${sub.score} / 10. Em đăng nhập để xem chi tiết nhé!\`;
      campaignData.push({ phone: zalo, message: msg });
    }
    triggerZaloCampaign(campaignData);
  };

  const notifyNotDoneZalo = () => {
    if (!essay || !students || students.length === 0) {
      alert("Danh sách học sinh trống. Vui lòng kiểm tra lại lớp được giao.");
      return;
    }
    const campaignData = [];
    const submittedIds = new Set(submissions.map(s => s.studentId));
    
    for (const s of students) {
      if (!submittedIds.has(s.uid) && s.zalo) {
        const msg = \`Chào em: \${s.name}. Hiện tại có bài tập chưa làm: \${essay.title || 'Bài tập tự luận'}. Em đăng nhập để làm nhé!\`;
        campaignData.push({ phone: s.zalo, message: msg });
      }
    }
    
    triggerZaloCampaign(campaignData);
  };
`;

code = code.replace('const executeSendSummaryZalo = async () => {', funcs + '\n  const executeSendSummaryZalo = async () => {');

// Buttons near "Thông báo nhóm"
const btnTarget = `<button 
                onClick={() => setShowNotifyModal(true)} 
                className="px-4 md:px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm transition-all shadow-sm border border-indigo-200 flex items-center justify-center whitespace-nowrap"
              >
                <Send className="w-4 h-4 mr-2" />
                Thông báo nhóm
              </button>`;

const btnReplacement = `<button 
                onClick={notifyScoreZalo} 
                className="px-4 md:px-5 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-bold text-sm transition-all shadow-sm border border-green-200 flex items-center justify-center whitespace-nowrap"
                title="Gửi điểm hàng loạt qua Zalo (100% tự động)"
              >
                <Send className="w-4 h-4 mr-2" />
                Báo điểm Zalo
              </button>
              <button 
                onClick={notifyNotDoneZalo} 
                className="px-4 md:px-5 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl font-bold text-sm transition-all shadow-sm border border-orange-200 flex items-center justify-center whitespace-nowrap"
                title="Nhắc các em chưa làm bài qua Zalo"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Nhắc chưa làm Zalo
              </button>
              ` + btnTarget;

code = code.replace(btnTarget, btnReplacement);

fs.writeFileSync('src/pages/EssayResults.tsx', code);
console.log('Patched EssayResults.tsx');
