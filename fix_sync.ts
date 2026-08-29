import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './firebase-applet-config.json' with { type: 'json' };

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

async function run() {
  const essaysSnap = await db.collection('teachers_essays_cover').get();
  for (const doc of essaysSnap.docs) {
    await doc.ref.delete();
    console.log('Deleted teachers_essays_cover for', doc.id);
  }

  const coversSnap = await db.collection('class_dashboard_cover').get();
  for (const doc of coversSnap.docs) {
    await doc.ref.delete();
    console.log('Deleted class_dashboard_cover for', doc.id);
  }
}

run().catch(console.error);
