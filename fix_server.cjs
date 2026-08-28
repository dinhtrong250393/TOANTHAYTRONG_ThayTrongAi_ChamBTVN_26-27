const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');
const target = `    const match = base64Image.match(/^data:(image\\/[a-z]+);base64,([\\s\\S]+)$/);
    if (!match) return "";
    const mimeType = match[1];
    const base64Data = match[2].trim();`;
c = c.replace(target, '');
fs.writeFileSync('server.ts', c);
