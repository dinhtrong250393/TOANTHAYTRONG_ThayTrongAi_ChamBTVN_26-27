const fs = require('fs');
const file = 'src/pages/EssayResults.tsx';
let code = fs.readFileSync(file, 'utf8');

const workerCode = `
  const runBackgroundGrading = async (ungradedSubs: any[], essayData: any, essayIdStr: string) => {
    let batchResults: any[] = [];
    
    for (let i = 0; i < ungradedSubs.length; i++) {
      const sub = ungradedSubs[i];
      let success = false;
      let attempt = 0;
      const maxRetries = 4;
      let baseDelay = 35000; // 35s initial backoff based on 39s Google wait time

      while (!success && attempt < maxRetries) {
        try {
          const { aiFeedback, score } = await gradeEssayClient(sub, essayData);
          
          const newSubData = {
            id: sub.id,
            aiFeedback: aiFeedback,
            score: score,
            status: 'graded',
            gradedAt: new Date().getTime(),
            studentId: sub.studentId
          };
          batchResults.push(newSubData);
          success = true;
          
          // Small delay between successful requests to prevent hitting 15 RPM immediately
          await new Promise(res => setTimeout(res, 4000));
          
        } catch (err: any) {
          const errorMsg = err.message || '';
          if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('Resource Exhausted') || errorMsg.includes('Timeout') || errorMsg.includes('500')) {
             attempt++;
             if (attempt >= maxRetries) {
               batchResults.push({ id: sub.id, status: 'grading_failed', errorMsg: 'Lỗi API quá nhiều lần.', studentId: sub.studentId });
               break;
             }
             // Exponential Backoff with Jitter
             const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 5000;
             console.warn(\`[Background Worker] Bị giới hạn API. Ngủ đông \${Math.round(delay/1000)}s rồi thử lại... (Lần \${attempt})\`);
             await new Promise(res => setTimeout(res, delay));
          } else {
             // Other error
             batchResults.push({ id: sub.id, status: 'grading_failed', errorMsg: errorMsg, studentId: sub.studentId });
             break;
          }
        }
      }
      
      // Batch Update every 10 items or at the very end
      if (batchResults.length >= 10 || i === ungradedSubs.length - 1) {
         console.log(\`[Background Worker] Ghi lô \${batchResults.length} bài vào Tờ bìa...\`);
         try {
           // 1. Update individual submissions (so full detail view works)
           for (const res of batchResults) {
             const subRef = doc(db, 'essay_submissions', res.id);
             await updateDoc(subRef, res);
             
             // Update student's completedEssays profile (optional but good for consistency)
             try {
                const userRef = doc(db, 'users', res.studentId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  const completedEssays = userData.completedEssays || [];
                  const index = completedEssays.findIndex((c: any) => c.essayId === essayIdStr);
                  if (index !== -1) {
                    completedEssays[index] = { ...completedEssays[index], score: res.score, status: res.status };
                    await updateDoc(userRef, { completedEssays });
                  } else {
                    completedEssays.push({
                      essayId: essayIdStr,
                      submissionId: res.id,
                      score: res.score,
                      status: res.status,
                      submittedAt: new Date().toISOString()
                    });
                    await updateDoc(userRef, { completedEssays });
                  }
                }
             } catch (e) {
                // Ignore profile update errors to not crash worker
             }
           }
           
           // 2. Update Cover Sheet ONLY ONCE PER BATCH (1 Read, 1 Write for Cover Sheet)
           const coverRef = doc(db, 'essay_results_cover', essayIdStr);
           const coverSnap = await getDoc(coverRef);
           if (coverSnap.exists()) {
             const coverData = coverSnap.data();
             let submissionSummary = coverData.submissionSummary || [];
             
             // Merge batch results into summary array
             for (const res of batchResults) {
               const idx = submissionSummary.findIndex((s: any) => s.id === res.id);
               if (idx !== -1) {
                 submissionSummary[idx] = { ...submissionSummary[idx], ...res };
               } else {
                 submissionSummary.push(res);
               }
             }
             
             await updateDoc(coverRef, { submissionSummary });
           }
         } catch (batchErr) {
           console.error("Lỗi ghi lô:", batchErr);
         }
         batchResults = []; // reset for next batch
      }
    }
  };

  const startBatchGrading = async () => {
    setShowBatchConfirm(false);
    const ungradedSubs = submissions.filter(s => s.status !== 'graded' && s.status !== 'grading' && s.status !== 'grading_in_progress');
    if (ungradedSubs.length === 0) return;

    const ids = ungradedSubs.map(s => s.id);
    setBatchGradingIds(ids);
    setIsGradingAll(true);
    setGradingProgress({ total: ids.length, current: 0 });

    // 1. Mark as grading locally (optimistic UI update to prevent double-clicks)
    const optimisticSubs = submissions.map(sub => 
      ids.includes(sub.id) ? { ...sub, status: 'grading_in_progress' } : sub
    );
    setSubmissions(optimisticSubs);

    // 2. Detach background worker!
    // We do NOT await this. It runs in the background.
    runBackgroundGrading(ungradedSubs, essay, essayId || '', ids).catch(console.error);
  };
`;

const regex = /const startBatchGrading = async \(\) => \{[\s\S]*?setIsGradingAll\(false\);\n    \}\n  \};/g;
if(code.match(regex)) {
  code = code.replace(regex, workerCode.trim());
  fs.writeFileSync(file, code);
  console.log('Worker patched');
} else {
  console.log('Regex missed');
}
