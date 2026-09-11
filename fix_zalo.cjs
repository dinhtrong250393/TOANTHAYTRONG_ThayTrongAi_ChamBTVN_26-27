const fs = require('fs');
const file = 'src/pages/EssayResults.tsx';
let code = fs.readFileSync(file, 'utf8');

// The issue is that the `students` array is not being populated automatically when the page loads, 
// unless the user clicks on a specific notification modal. We need to load it proactively.

// Find the useEffect that loads the essay and submissions
const searchStr = `setSubmissions(submissionsList);`;
const replacementStr = `setSubmissions(submissionsList);

      // --- FIX: PROACTIVELY LOAD STUDENTS FOR ZALO NOTIFICATIONS ---
      let studs: any[] = [];
      if (essayData && essayData.assignedClasses && essayData.assignedClasses.length > 0) {
        for (const cls of essayData.assignedClasses) {
          const classCoverDoc = await getDoc(doc(db, 'class_students_cover', cls));
          if (classCoverDoc.exists()) {
            const data = classCoverDoc.data();
            studs = studs.concat((data.students || []).map((s: any) => ({ ...s, className: cls })));
          } else {
            const syncStuds = await syncClassStudentsCover(cls);
            studs = studs.concat((syncStuds || []).map((s: any) => ({ ...s, className: cls })));
          }
        }
      }
      setStudents(studs);
      // --- END FIX ---`;

code = code.replace(searchStr, replacementStr);

fs.writeFileSync(file, code);
console.log('Fixed proactive student loading');
