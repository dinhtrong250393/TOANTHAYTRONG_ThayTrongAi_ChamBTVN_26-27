const fs = require('fs');
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the old point 6 with a stricter barem instruction
const oldPrompt = '6. Đưa ra điểm số cuối cùng (từ 0 đến 10, có thể lẻ đến 0.25).';
const newPrompt = `6. KIỂM TRA KỸ THANG ĐIỂM (BAREM): Bạn BẮT BUỘC phải bám sát thang điểm (barem) của từng ý, từng câu được ghi trong Đề bài hoặc Lời giải chuẩn. 
   - NẾU câu A được giao 5.0 điểm, BẠN CHỈ ĐƯỢC CHẤM TỐI ĐA 5.0 ĐIỂM cho câu A (không được chấm 4.0 hay 6.0).
   - Cộng tổng điểm đạt được một cách chính xác và lô-gic nhất (từ 0 đến 10, có thể lẻ đến 0.25).`;

code = code.replace(oldPrompt, newPrompt);

fs.writeFileSync(file, code);
console.log('Fixed Barem grading instructions');
