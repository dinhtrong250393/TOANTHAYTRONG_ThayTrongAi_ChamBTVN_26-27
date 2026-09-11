const fs = require('fs');
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Update prompt
code = code.replace(
  'TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON TUYỆT ĐỐI THEO ĐỊNH DẠNG SAU:',
  'LƯU Ý QUAN TRỌNG VỀ JSON: NẾU TRONG NHẬN XÉT CÓ SỬ DỤNG CÔNG THỨC TOÁN HỌC LATEX (VD: \\infty, \\geq), BẠN PHẢI ESCAPE DẤU BACKSLASH THÀNH 2 DẤU (VD: \\\\infty, \\\\geq) ĐỂ ĐẢM BẢO CHUỖI JSON HỢP LỆ.\n\nTRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON TUYỆT ĐỐI THEO ĐỊNH DẠNG SAU:'
);

// 2. Sanitize before parsing
const parseRegex = /jsonResult = JSON\.parse\(text\);/g;
const replacement = `// Sanitize text for common LaTeX unescaped backslashes before parsing
          let sanitizedText = text.replace(/\\\\([^"\\\\/bfnrtu])/g, '\\\\\\\\$1');
          try {
            jsonResult = JSON.parse(sanitizedText);
          } catch (parseErr) {
            jsonResult = JSON.parse(text);
          }`;

code = code.replace(parseRegex, replacement);

fs.writeFileSync(file, code);
console.log('Fixed JSON parsing');
