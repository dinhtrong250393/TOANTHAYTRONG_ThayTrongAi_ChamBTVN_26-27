import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const essaysSnap = await getDocs(collection(db, 'essays'));
  console.log("ESSAYS:");
  essaysSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.title && data.title.includes("Bài 1.")) {
      console.log("-", data.title, data.assignedClasses, "tbLessonId:", data.textbookLessonId);
    }
  });

  const lessonsSnap = await getDocs(collection(db, 'textbook_lessons'));
  console.log("\nLESSONS:");
  lessonsSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log("-", data.name, data.assignedClasses);
  });
}

run().catch(console.error);
