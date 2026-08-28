const fs = require('fs');

function patchExamResults() {
  let code = fs.readFileSync('src/pages/ExamResults.tsx', 'utf8');

  // Inject triggerZaloCampaign if missing
  if (!code.includes('import { triggerZaloCampaign }')) {
    code = code.replace(
      /import \{ db, handleFirestoreError, OperationType \} from '\.\.\/lib\/firebase';/,
      `import { db, handleFirestoreError, OperationType } from '../lib/firebase';\nimport { triggerZaloCampaign } from '../lib/zaloUtils';`
    );
  }

  // Inject functions if missing
  if (!code.includes('const notifyScoreZalo = () => {')) {
    const funcs = `
  const notifyScoreZalo = () => {
    if (!exam) return;
    const gradedSubs = submissions.filter(s => s.score !== undefined && s.score !== null);
    if (gradedSubs.length === 0) {
      alert("Chưa có học sinh nào có điểm.");
      return;
    }
    const campaignData = [];
    for (const sub of gradedSubs) {
      const student = students.find(s => s.uid === sub.studentId);
      const zalo = sub.studentZalo || (student && student.zalo) || null;
      if (!zalo) continue;
      const msg = \`Chào em: \${sub.studentName}. Hiện tại đã có điểm bài: \${exam.title || 'Bài thi'}. Điểm của em: \${sub.score} / 10. Em đăng nhập để xem chi tiết nhé!\`;
      campaignData.push({ phone: zalo, message: msg });
    }
    if (campaignData.length === 0) {
        alert("Không có số Zalo hợp lệ nào để gửi.");
        return;
    }
    triggerZaloCampaign(campaignData);
  };

  const notifyNotDoneZalo = () => {
    if (!exam || !students || students.length === 0) {
      alert("Danh sách học sinh trống. Vui lòng kiểm tra lại lớp được giao.");
      return;
    }
    const campaignData = [];
    const submittedIds = new Set(submissions.map(s => s.studentId));
    
    for (const s of students) {
      if (!submittedIds.has(s.uid) && s.zalo) {
        const msg = \`Chào em: \${s.name}. Hiện tại có bài tập chưa làm: \${exam.title || 'Bài thi'}. Em đăng nhập để làm nhé!\`;
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

  // Replace buttons
  const buttonRegex = /<button[\s\S]*?onClick=\{\(\) => \{\s*setShowNotifyModal\(true\);\s*loadClassStudents\(\);\s*\}\}[\s\S]*?Thông báo nhóm<\/span>\s*<\/button>/;
  const match = code.match(buttonRegex);
  
  if (match) {
    const btnTarget = match[0];
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
    code = code.replace(btnTarget, btnReplacement);
    fs.writeFileSync('src/pages/ExamResults.tsx', code);
    console.log('Patched ExamResults.tsx');
  } else {
    console.log('Could not find button target in ExamResults.tsx');
  }
}

function patchEssayResults() {
  let code = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');

  // Inject triggerZaloCampaign if missing
  if (!code.includes('import { triggerZaloCampaign }')) {
    code = code.replace(
      /import \{ db, handleFirestoreError, OperationType \} from '\.\.\/lib\/firebase';/,
      `import { db, handleFirestoreError, OperationType } from '../lib/firebase';\nimport { triggerZaloCampaign } from '../lib/zaloUtils';`
    );
  }

  // Inject functions if missing
  if (!code.includes('const notifyScoreZalo = () => {')) {
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
    if (campaignData.length === 0) {
        alert("Không có số Zalo hợp lệ nào để gửi.");
        return;
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
    
    if (campaignData.length === 0) {
        alert("Tất cả học sinh có số Zalo đều đã làm bài.");
        return;
    }
    triggerZaloCampaign(campaignData);
  };
`;
    code = code.replace('const executeSendSummaryZalo = async () => {', funcs + '\n  const executeSendSummaryZalo = async () => {');
  }

  // Replace buttons
  const buttonRegex = /<button[\s\S]*?onClick=\{\(\) => \{\s*setShowNotifyModal\(true\);\s*loadClassStudents\(\);\s*\}\}[\s\S]*?Thông báo nhóm<\/span>\s*<\/button>/;
  const match = code.match(buttonRegex);
  
  if (match) {
    const btnTarget = match[0];
    const btnReplacement = `
              <button 
                onClick={notifyScoreZalo} 
                className="flex items-center px-4 py-2 bg-green-50 text-green-600 rounded-xl font-semibold hover:bg-green-100 transition-colors shadow-sm text-xs md:text-sm"
                title="Gửi điểm hàng loạt qua Zalo (100% tự động)"
              >
                <Send className="w-4 h-4 mr-1.5 md:mr-2" />
                <span className="hidden sm:inline">Báo điểm Zalo</span>
              </button>
              <button 
                onClick={notifyNotDoneZalo} 
                className="flex items-center px-4 py-2 bg-orange-50 text-orange-600 rounded-xl font-semibold hover:bg-orange-100 transition-colors shadow-sm text-xs md:text-sm"
                title="Nhắc các em chưa làm bài qua Zalo"
              >
                <AlertCircle className="w-4 h-4 mr-1.5 md:mr-2" />
                <span className="hidden sm:inline">Nhắc chưa làm Zalo</span>
              </button>
              ${btnTarget.replace('bg-green-50', 'bg-indigo-50').replace('text-green-600', 'text-indigo-600').replace('hover:bg-green-100', 'hover:bg-indigo-100')}
`;
    code = code.replace(btnTarget, btnReplacement);
    fs.writeFileSync('src/pages/EssayResults.tsx', code);
    console.log('Patched EssayResults.tsx');
  } else {
    console.log('Could not find button target in EssayResults.tsx');
  }
}

patchExamResults();
patchEssayResults();
