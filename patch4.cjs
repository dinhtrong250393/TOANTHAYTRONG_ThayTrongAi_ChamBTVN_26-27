const fs = require('fs');

function patchFile(file) {
  let code = fs.readFileSync(file, 'utf8');

  // Inject triggerZaloCampaign if missing
  if (!code.includes('import { triggerZaloCampaign }')) {
    code = code.replace(
      /import \{ db, handleFirestoreError, OperationType \} from '\.\.\/lib\/firebase';/,
      `import { db, handleFirestoreError, OperationType } from '../lib/firebase';\nimport { triggerZaloCampaign } from '../lib/zaloUtils';`
    );
  }

  // Inject functions if missing
  if (!code.includes('const notifyScoreZalo = () => {')) {
    const isExam = file.includes('Exam');
    const titleObj = isExam ? 'exam' : 'essay';
    const subCondition = isExam ? 's.score !== undefined && s.score !== null' : "s.status === 'graded'";
    
    const funcs = `
  const notifyScoreZalo = () => {
    if (!${titleObj}) return;
    const gradedSubs = submissions.filter(s => ${subCondition});
    if (gradedSubs.length === 0) {
      alert("Chưa có học sinh nào có điểm.");
      return;
    }
    const campaignData = [];
    for (const sub of gradedSubs) {
      const student = students.find(s => s.uid === sub.studentId);
      const zalo = sub.studentZalo || (student && student.zalo) || null;
      if (!zalo) continue;
      const msg = \`Chào em: \${sub.studentName}. Hiện tại đã có điểm bài: \${${titleObj}.title || 'Bài tập'}. Điểm của em: \${sub.score} / 10. Em đăng nhập để xem chi tiết nhé!\`;
      campaignData.push({ phone: zalo, message: msg });
    }
    if (campaignData.length === 0) {
        alert("Không có số Zalo hợp lệ nào để gửi.");
        return;
    }
    triggerZaloCampaign(campaignData);
  };

  const notifyNotDoneZalo = () => {
    if (!${titleObj} || !students || students.length === 0) {
      alert("Danh sách học sinh trống. Vui lòng kiểm tra lại lớp được giao.");
      return;
    }
    const campaignData = [];
    const submittedIds = new Set(submissions.map(s => s.studentId));
    
    for (const s of students) {
      if (!submittedIds.has(s.uid) && s.zalo) {
        const msg = \`Chào em: \${s.name}. Hiện tại có bài tập chưa làm: \${${titleObj}.title || 'Bài tập'}. Em đăng nhập để làm nhé!\`;
        campaignData.push({ phone: s.zalo, message: msg });
      }
    }
    
    if (campaignData.length === 0) {
        alert("Tất cả học sinh có số Zalo đều đã làm bài.");
        return;
    }
    triggerZaloCampaign(campaignData);
  };
`;
    code = code.replace('const executeSendSummaryZalo = async () => {', funcs + '\n  const executeSendSummaryZalo = async () => {');
  }

  // Replace buttons - just look for "Thông báo nhóm" string and replace its parent button
  const parts = code.split('Thông báo nhóm');
  if (parts.length > 1 && !code.includes('Báo điểm Zalo')) {
    // find the previous '<button' index
    const beforeStr = parts[0];
    const buttonStartIndex = beforeStr.lastIndexOf('<button');
    if (buttonStartIndex !== -1) {
       const nextPart = parts[1];
       const buttonEndIndex = nextPart.indexOf('</button>') + '</button>'.length;
       
       const btnTarget = code.substring(buttonStartIndex, beforeStr.length + 'Thông báo nhóm'.length + buttonEndIndex);
       
       const btnReplacement = `
            <button 
              onClick={notifyScoreZalo} 
              className="flex items-center px-4 py-2 bg-green-50 text-green-600 rounded-xl font-semibold hover:bg-green-100 transition-colors shadow-sm"
              title="Gửi điểm hàng loạt qua Zalo (100% tự động)"
            >
              <Send className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Báo điểm Zalo</span>
            </button>
            <button 
              onClick={notifyNotDoneZalo} 
              className="flex items-center px-4 py-2 bg-orange-50 text-orange-600 rounded-xl font-semibold hover:bg-orange-100 transition-colors shadow-sm"
              title="Nhắc các em chưa làm bài qua Zalo"
            >
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Nhắc chưa làm Zalo</span>
            </button>
            ${btnTarget.replace('bg-green-50', 'bg-indigo-50').replace('text-green-600', 'text-indigo-600').replace('hover:bg-green-100', 'hover:bg-indigo-100')}
`;
       code = code.substring(0, buttonStartIndex) + btnReplacement + code.substring(beforeStr.length + 'Thông báo nhóm'.length + buttonEndIndex);
       fs.writeFileSync(file, code);
       console.log('Patched ' + file);
    }
  }
}

patchFile('src/pages/ExamResults.tsx');
patchFile('src/pages/EssayResults.tsx');
