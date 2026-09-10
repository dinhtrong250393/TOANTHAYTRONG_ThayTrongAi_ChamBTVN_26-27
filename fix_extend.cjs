const fs = require('fs');

// 1. Update TeacherTextbookTab
let tabCode = fs.readFileSync('src/components/TeacherTextbookTab.tsx', 'utf8');
tabCode = tabCode.replace(
  'syncingEssayId?: string | null;',
  'syncingEssayId?: string | null;\n  essayUpdatedSignal?: number;'
);
tabCode = tabCode.replace(
  '  syncingEssayId\n}: TeacherTextbookTabProps',
  '  syncingEssayId,\n  essayUpdatedSignal\n}: TeacherTextbookTabProps'
);
tabCode = tabCode.replace(
  '}, [currentLesson]);',
  '}, [currentLesson, essayUpdatedSignal]);'
);
fs.writeFileSync('src/components/TeacherTextbookTab.tsx', tabCode);

// 2. Update TeacherDashboard
let dashCode = fs.readFileSync('src/pages/TeacherDashboard.tsx', 'utf8');
dashCode = dashCode.replace(
  'const [essayToExtend, setEssayToExtend] = useState<any>(null);',
  'const [essayToExtend, setEssayToExtend] = useState<any>(null);\n  const [essayUpdatedSignal, setEssayUpdatedSignal] = useState(0);'
);
dashCode = dashCode.replace(
  'setEssays(essays.map(e => e.id === essayToExtend.id ? { ...e, endTime: newEndTime } : e));',
  'setEssays(essays.map(e => e.id === essayToExtend.id ? { ...e, endTime: newEndTime } : e));\n      setEssayUpdatedSignal(prev => prev + 1);'
);
dashCode = dashCode.replace(
  'syncingEssayId={syncingEssayId}',
  'syncingEssayId={syncingEssayId}\n                essayUpdatedSignal={essayUpdatedSignal}'
);
fs.writeFileSync('src/pages/TeacherDashboard.tsx', dashCode);
console.log('Fixed extend time for sub essays');
