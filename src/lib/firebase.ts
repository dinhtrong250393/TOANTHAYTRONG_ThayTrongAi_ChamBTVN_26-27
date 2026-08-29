import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import rawFirebaseConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  ...rawFirebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || rawFirebaseConfig.apiKey
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const syncTeacherSummary = async (teacherId: string) => {
  // Deprecated: We no longer sync to teacher_summaries to save quota.
  // TeacherDashboard now fetches directly.
  return;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';

storage.maxUploadRetryTime = 5000; // 5 seconds max retry for uploads to prevent hanging

export const uploadBase64ToStorage = async (base64String: string, path: string): Promise<string> => {
  const CLOUDINARY_CLOUD_NAME = 'ao9sncyh';
  const CLOUDINARY_UPLOAD_PRESET = 'KIEM TRA BAI TAP';

  try {
    // 1. Chuyển đổi Data URL thành Blob bằng fetch API (Hardware Acceleration)
    // Nhanh và không tốn RAM trên Android so với vòng lặp atob() cũ
    const fetchResponse = await fetch(base64String);
    const blob = await fetchResponse.blob();

    // 2. Chuẩn bị dữ liệu gửi lên Cloudinary
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    // Tạo folder ảo dựa trên đường dẫn hiện tại (để dễ quản lý trên bảng điều khiển Cloudinary)
    const folderName = path.includes('/') ? path.split('/')[0] : 'essay_submissions';
    formData.append('folder', folderName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

    try {
      console.log('Đang tải ảnh lên Cloudinary...');
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok && data.secure_url) {
        console.log('Tải ảnh lên Cloudinary thành công!');
        // Trả về link ảnh HTTPS an toàn và vĩnh viễn của Cloudinary
        return data.secure_url;
      } else {
        const errorMsg = data.error?.message || 'Lỗi không xác định từ Cloudinary';
        console.error('Cloudinary từ chối ảnh:', errorMsg);
        throw new Error('Cloudinary từ chối ảnh: ' + errorMsg);
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.error('Lỗi kết nối tới Cloudinary:', fetchErr.message);
      throw new Error('Lỗi mạng khi tải ảnh lên máy chủ Cloudinary: ' + fetchErr.message);
    }
  } catch (error: any) {
    console.error('Lỗi khi xử lý tải ảnh:', error);
    throw new Error('Không thể tải ảnh lên, vui lòng thử lại sau. ' + (error.message || ''));
  }
};

// --- QUOTA OPTIMIZATION: TWO-LAYER COVER CODES ---

export const syncExamsCover = async (teacherId: string) => {
  try {
    const q = query(collection(db, 'exams'), where('teacherId', '==', teacherId));
    const snap = await getDocs(q);
    const examsList = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        assignedClasses: data.assignedClasses || [],
        createdAt: data.createdAt || '',
        endTime: data.endTime || '',
        startTime: data.startTime || '',
        duration: data.duration || 0,
        status: data.status || 'published',
        submissionSummary: data.submissionSummary || []
      };
    });
    await setDoc(doc(db, 'teachers_exams_cover', teacherId), { examsList }, { merge: true });
    return examsList;
  } catch (error) {
    console.error('Error syncing exams cover:', error);
    return [];
  }
};

export const syncEssaysCover = async (teacherId: string) => {
  try {
    const q = query(collection(db, 'essays'), where('teacherId', '==', teacherId));
    const snap = await getDocs(q);
    const essaysList = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        assignedClasses: data.assignedClasses || [],
        createdAt: data.createdAt || '',
        endTime: data.endTime || '',
        startTime: data.startTime || '',
        duration: data.duration || 0,
        status: data.status || 'published',
        submissionSummary: data.submissionSummary || [],
        textbookLessonId: data.textbookLessonId || null
      };
    });
    await setDoc(doc(db, 'teachers_essays_cover', teacherId), { essaysList }, { merge: true });
    return essaysList;
  } catch (error) {
    console.error('Error syncing essays cover:', error);
    return [];
  }
};

export const syncKnowledgesCover = async (teacherId: string) => {
  try {
    const q = query(collection(db, 'knowledges'), where('teacherId', '==', teacherId));
    const snap = await getDocs(q);
    const knowledgesList = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        assignedClasses: data.assignedClasses || [],
        createdAt: data.createdAt || '',
        block: data.block || '0'
      };
    });
    await setDoc(doc(db, 'teachers_knowledges_cover', teacherId), { knowledgesList }, { merge: true });
    return knowledgesList;
  } catch (error) {
    console.error('Error syncing knowledges cover:', error);
    return [];
  }
};

export const syncExamResultsCover = async (examId: string) => {
  try {
    const examSnap = await getDoc(doc(db, 'exams', examId));
    if (examSnap.exists()) {
      const examData = examSnap.data();
      const resultsCoverData = {
        id: examId,
        title: examData.title || '',
        teacherId: examData.teacherId || '',
        duration: examData.duration || 0,
        status: examData.status || 'published',
        assignedClasses: examData.assignedClasses || [],
        submissionSummary: examData.submissionSummary || [],
        createdAt: examData.createdAt || '',
        startTime: examData.startTime || '',
        endTime: examData.endTime || '',
        questions: examData.questions || []
      };
      await setDoc(doc(db, 'exam_results_cover', examId), resultsCoverData, { merge: true });
      return resultsCoverData;
    }
  } catch (error) {
    console.error('Error syncing exam results cover:', error);
  }
  return { id: examId, title: '', assignedClasses: [], submissionSummary: [], createdAt: '', endTime: '', questions: [] };
};

export const syncEssayResultsCover = async (essayId: string) => {
  try {
    const essaySnap = await getDoc(doc(db, 'essays', essayId));
    if (essaySnap.exists()) {
      const essayData = essaySnap.data();
      
      // Query actual submissions to rebuild the summary (healing inconsistencies)
      const submissionsQuery = query(collection(db, 'essay_submissions'), where('essayId', '==', essayId));
      const subSnap = await getDocs(submissionsQuery);
      
      const realSummary = subSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          studentId: data.studentId,
          studentName: data.studentName,
          studentClass: data.studentClass || '',
          studentZalo: data.studentZalo || null,
          studentFacebook: data.studentFacebook || null,
          submittedAt: data.submittedAt,
          status: data.status,
          score: data.score
        };
      });

      // Update main essay to fix any inconsistencies
      await updateDoc(doc(db, 'essays', essayId), {
        submissionSummary: realSummary
      });

      // Also update metadata if needed
      await updateDoc(doc(db, 'essays_metadata', essayId), {
        submissionSummary: realSummary
      }).catch(() => {});

      const resultsCoverData = {
        id: essayId,
        title: essayData.title || '',
        assignedClasses: essayData.assignedClasses || [],
        submissionSummary: realSummary,
        createdAt: essayData.createdAt || '',
        endTime: essayData.endTime || ''
      };
      await setDoc(doc(db, 'essay_results_cover', essayId), resultsCoverData, { merge: true });
      return resultsCoverData;
    }
  } catch (error) {
    console.error('Error syncing essay results cover:', error);
  }
  return { id: essayId, title: '', assignedClasses: [], submissionSummary: [], createdAt: '', endTime: '' };
};

