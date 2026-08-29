import fs from 'fs';
let content = fs.readFileSync('src/components/TeacherTextbookTab.tsx', 'utf8');

content = content.replace(
  /    <\/div>\n      \{itemToDelete && \(/g,
  '      {itemToDelete && (\n'
);

content = content.replace(
  /        <\/div>\n      \)\}\n  \);\n\}/g,
  '        </div>\n      )}\n    </div>\n  );\n}'
);

fs.writeFileSync('src/components/TeacherTextbookTab.tsx', content);
