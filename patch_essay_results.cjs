const fs = require('fs');
const file = 'src/pages/EssayResults.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Replace startBatchGrading
const batchGradingRegex = /const startBatchGrading = async \(\) => \{[\s\S]*?setShowBatchSuccess\(true\);\n  \};/;
const newBatchGrading = `const startBatchGrading = async () => {
    setShowBatchConfirm(false);
    const ungradedSubs = submissions.filter(s => s.status !== 'graded' && s.status !== 'grading' && s.status !== 'grading_in_progress');
    if (ungradedSubs.length === 0) return;

    const ids = ungradedSubs.map(s => s.id);
    setBatchGradingIds(ids);
    setIsGradingAll(true);
    setGradingProgress({ total: ids.length, current: 0 });

    try {
      // 1. Mark as grading locally (optimistic UI update)
      const optimisticSubs = submissions.map(sub => 
        ids.includes(sub.id) ? { ...sub, status: 'grading_in_progress' } : sub
      );
      setSubmissions(optimisticSubs);

      // 2. Call backend batch grading queue
      const response = await fetch('/api/grade-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          essayId: essay?.id || essayId,
          submissionIds: ids,
          studentApiKey: null // or pass a generic teacher token if you want to route to their keys
        })
      });

      if (!response.ok) {
        throw new Error('Không thể khởi chạy tiến trình chấm điểm');
      }

      // Backend worker handles the rest! The onSnapshot will update UI automatically.
    } catch (err: any) {
      console.error(err);
      alert('Lỗi: ' + err.message);
      setIsGradingAll(false);
    }
  };`;
code = code.replace(batchGradingRegex, newBatchGrading);

// 2. Replace loadData with onSnapshot
const loadDataRegex = /let unsubscribe: \(\) => void;[\s\S]*?\}, \[essayId\]\);/g;
const loadDataOrigRegex = /const loadData = async \(\) => \{[\s\S]*?setLoading\(false\);\n      \}\n    \};\n\n    loadData\(\);\n  \}, \[essayId\]\);/g;

const newLoadData = `let unsubscribe: () => void;
    
    const loadDataAndListen = async () => {
      try {
        const essayDoc = await getDoc(doc(db, 'essays', essayId));
        const originalEssayData = essayDoc.exists() ? essayDoc.data() : {};

        const coverRef = doc(db, 'essay_results_cover', essayId);
        
        unsubscribe = onSnapshot(coverRef, async (coverSnap) => {
          let submissionsList: any[] = [];
          let essayData: any = null;

          if (coverSnap.exists()) {
            const coverData = coverSnap.data();
            submissionsList = coverData.submissionSummary || [];
            essayData = {
              id: essayId,
              ...originalEssayData,
              title: coverData.title || originalEssayData.title || '',
              submissionSummary: submissionsList
            };
          } else {
            const cover = await syncEssayResultsCover(essayId);
            submissionsList = cover.submissionSummary || [];
            essayData = {
              id: essayId,
              ...originalEssayData,
              title: cover.title || originalEssayData.title || '',
              submissionSummary: submissionsList
            };
          }

          setEssay(essayData);
          setSubmissions(submissionsList);
          
          setLoading(false);
        }, (error) => {
          console.error("Lỗi lắng nghe dữ liệu:", error);
          setError("Lỗi đồng bộ dữ liệu theo thời gian thực.");
          setLoading(false);
        });

      } catch (err: any) {
        console.error(err);
        setError('Lỗi tải dữ liệu. Vui lòng thử lại.');
        setLoading(false);
      }
    };

    loadDataAndListen();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [essayId]);`;

if (code.match(loadDataRegex)) {
  code = code.replace(loadDataRegex, newLoadData);
} else {
  code = code.replace(loadDataOrigRegex, newLoadData);
}

fs.writeFileSync(file, code);
console.log('EssayResults patched');
