const fs = require('fs');
let code = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');

code = code.replace(
  "import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';",
  "import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';"
);

code = code.replace(
  "const { deleteDoc } = require('firebase/firestore');",
  ""
);

fs.writeFileSync('src/pages/EssayResults.tsx', code);
console.log("Fixed require in EssayResults.tsx");
