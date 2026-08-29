import fs from 'fs';
let content = fs.readFileSync('src/pages/TextbookBuilder.tsx', 'utf8');

content = content.replace(
  'Chụp hoặc tải lên một trang sách chứa các bài tập bạn muốn giao cho học sinh.',
  'Chụp hoặc tải lên ảnh / file PDF chứa các bài tập bạn muốn giao cho học sinh.'
);

fs.writeFileSync('src/pages/TextbookBuilder.tsx', content);
