const fs = require('fs');
let c = fs.readFileSync('src/lib/firebase.ts', 'utf8');

c = c.replace(
/export const syncTeacherSummary = async \(teacherId: string\) => \{[\s\S]*?\}\;/g,
`export const syncTeacherSummary = async (teacherId: string) => {
  // Deprecated: We no longer sync to teacher_summaries to save quota.
  // TeacherDashboard now fetches directly.
  return;
};`
);

fs.writeFileSync('src/lib/firebase.ts', c);
