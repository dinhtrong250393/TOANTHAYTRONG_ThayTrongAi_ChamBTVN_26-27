const fs = require('fs');
let c = fs.readFileSync('src/lib/syncUtils.ts', 'utf8');

c = c.replace(
/export const syncClassSummary = async \(className: string\) => \{[\s\S]*\}\;/g,
`export const syncClassSummary = async (className: string) => {
  // Deprecated: We no longer sync to class_summaries to save quota and avoid 1MB document limits.
  // StudentDashboard now fetches directly.
  return;
};`
);

fs.writeFileSync('src/lib/syncUtils.ts', c);
