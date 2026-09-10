import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ projectId: "kiemtrabtvn-b5ddd" });
const db = getFirestore();
db.collection('test').limit(1).get().then(() => console.log('Admin Firestore works!')).catch(console.error);
