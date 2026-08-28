const fs = require('fs');
let c = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf8');

c = c.replace(
/      let data: any = \{ exams: \[\], knowledges: \[\], essays: \[\] \};\n      if \(!forceDirect\) \{\n        const summaryDoc = await getDoc\(doc\(db, 'class_summaries', appUser\.className\)\);\n        if \(summaryDoc\.exists\(\)\) \{\n          data = summaryDoc\.data\(\);\n        \} else \{\n          data = await fetchClassDataDirectly\(appUser\.className\);\n        \}\n      \} else \{\n        data = await fetchClassDataDirectly\(appUser\.className\);\n      \}/,
`      let data: any = await fetchClassDataDirectly(appUser.className);`
);

fs.writeFileSync('src/pages/StudentDashboard.tsx', c);
