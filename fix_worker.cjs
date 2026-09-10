const fs = require('fs');
const file = 'src/pages/EssayResults.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const runBackgroundGrading = async \(ungradedSubs: any\[\], essayData: any, essayIdStr: string\) => \{/, 'const runBackgroundGrading = async (ungradedSubs: any[], essayData: any, essayIdStr: string, batchGradingIds: string[]) => {');

fs.writeFileSync(file, code);
