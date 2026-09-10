const fs = require('fs');
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/res\.status\(500\)\.json\(\{ error: error\.message \|\| "Failed to grade" \}\);/g, 
`if (error.message && (error.message.includes("429") || error.message.includes("Resource Exhausted") || error.message.includes("Quota"))) {
        res.status(429).json({ error: error.message || "Quá giới hạn API. Vui lòng thử lại sau." });
      } else {
        res.status(500).json({ error: error.message || "Failed to grade" });
      }`);

fs.writeFileSync(file, code);
