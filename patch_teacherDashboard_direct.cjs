const fs = require('fs');
let c = fs.readFileSync('src/pages/TeacherDashboard.tsx', 'utf8');

c = c.replace(
/      if \(forceSync === true\) \{\n        await syncTeacherSummary\(appUser\.uid\);\n      \}\n\n      const summaryRef = doc\(db, 'teacher_summaries', appUser\.uid\);\n      const summarySnap = await getDoc\(summaryRef\);\n\n      let examsList = \[\];\n      let knowledgesList = \[\];\n      if \(summarySnap\.exists\(\)\) \{\n        const data = summarySnap\.data\(\);\n        examsList = data\.exams \|\| \[\];\n        knowledgesList = data\.knowledges \|\| \[\];\n      \} else \{\n        \/\/ Fallback: fetch everything directly if summary somehow failed\n        const qExams = query\(collection\(db, 'exams'\), where\('teacherId', '==', appUser\.uid\)\);\n        const examSnap = await getDocs\(qExams\);\n        examsList = examSnap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);\n\n        const qKnowledges = query\(collection\(db, 'knowledges'\), where\('teacherId', '==', appUser\.uid\)\);\n        const knowledgeSnap = await getDocs\(qKnowledges\);\n        knowledgesList = knowledgeSnap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);\n      \}/,
`      let examsList = [];
      let knowledgesList = [];
      
      const qExams = query(collection(db, 'exams'), where('teacherId', '==', appUser.uid));
      const examSnap = await getDocs(qExams);
      examsList = examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const qKnowledges = query(collection(db, 'knowledges'), where('teacherId', '==', appUser.uid));
      const knowledgeSnap = await getDocs(qKnowledges);
      knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));`
);

fs.writeFileSync('src/pages/TeacherDashboard.tsx', c);
