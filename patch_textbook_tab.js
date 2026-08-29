import fs from 'fs';

let content = fs.readFileSync('src/components/TeacherTextbookTab.tsx', 'utf8');

content = content.replace(
  'Bấm vào đây để tải SGK và cắt đề ngay!',
  'Bấm vào đây để tải ảnh bài tập lên ngay!'
);

content = content.replace(
  'Tải SGK lên và Cắt đề',
  'Tải ảnh bài tập lên'
);

fs.writeFileSync('src/components/TeacherTextbookTab.tsx', content);
