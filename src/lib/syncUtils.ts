import { collection, query, where, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export const saveExamMetadata = async (examId: string, examData: any) => {
  if (!examId) return;
  try {
    const metadata: any = {
      id: examId,
      title: examData.title || '',
      teacherId: examData.teacherId || '',
      duration: examData.duration || 0,
      status: examData.status || 'draft',
      assignedClasses: examData.assignedClasses || [],
      createdAt: examData.createdAt || Date.now(),
    };
    if (examData.endTime !== undefined) metadata.endTime = examData.endTime;
    if (examData.submissionSummary !== undefined) metadata.submissionSummary = examData.submissionSummary;
    
    await setDoc(doc(db, 'exams_metadata', examId), metadata, { merge: true });

    // Auto-update class covers
    if (Array.isArray(examData.assignedClasses)) {
      examData.assignedClasses.forEach((cls: string) => syncClassDashboardCover(cls));
    }
  } catch (err) {
    console.error("Error saving exam metadata:", err);
  }
};

export const saveEssayMetadata = async (essayId: string, essayData: any) => {
  if (!essayId) return;
  try {
    const metadata: any = {
      id: essayId,
      title: essayData.title || '',
      teacherId: essayData.teacherId || '',
      assignedClasses: essayData.assignedClasses || [],
      createdAt: essayData.createdAt || Date.now(),
    };
    if (essayData.endTime !== undefined) metadata.endTime = essayData.endTime;
    if (essayData.submissionSummary !== undefined) metadata.submissionSummary = essayData.submissionSummary;
    
    await setDoc(doc(db, 'essays_metadata', essayId), metadata, { merge: true });

    // Auto-update class covers
    if (Array.isArray(essayData.assignedClasses)) {
      essayData.assignedClasses.forEach((cls: string) => syncClassDashboardCover(cls));
    }
  } catch (err) {
    console.error("Error saving essay metadata:", err);
  }
};

export const saveKnowledgeMetadata = async (knowledgeId: string, knowledgeData: any) => {
  if (!knowledgeId) return;
  try {
    const metadata = {
      id: knowledgeId,
      title: knowledgeData.title || '',
      teacherId: knowledgeData.teacherId || '',
      block: knowledgeData.block || '',
      className: knowledgeData.className || '',
      createdAt: knowledgeData.createdAt || Date.now()
    };
    await setDoc(doc(db, 'knowledges_metadata', knowledgeId), metadata, { merge: true });

    // Auto-update class cover
    if (knowledgeData.className) {
      syncClassDashboardCover(knowledgeData.className);
    }
  } catch (err) {
    console.error("Error saving knowledge metadata:", err);
  }
};

export const deleteExamMetadata = async (examId: string) => {
  if (!examId) return;
  try {
    await deleteDoc(doc(db, 'exams_metadata', examId));
  } catch (err) {
    console.error("Error deleting exam metadata:", err);
  }
};

export const deleteEssayMetadata = async (essayId: string) => {
  if (!essayId) return;
  try {
    await deleteDoc(doc(db, 'essays_metadata', essayId));
  } catch (err) {
    console.error("Error deleting essay metadata:", err);
  }
};

export const syncClassStudentsCover = async (className: string) => {
  if (!className) return [];
  try {
    const qStudents = query(
      collection(db, 'users'),
      where('className', '==', className)
    );
    const snap = await getDocs(qStudents);
    const activeStudentsList = snap.docs
      .filter(doc => doc.data().role === 'student')
      .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: doc.id,
        name: data.name || '',
        email: data.email || '',
        personalEmail: data.personalEmail || '',
        role: 'student',
        status: data.status || 'active',
        dob: data.dob || '',
        className: data.className || className,
        schoolInfo: data.schoolInfo || '',
        address: data.address || '',
        zalo: data.zalo || '',
        facebook: data.facebook || '',
        parentName: data.parentName || '',
        parentRelation: data.parentRelation || '',
        parentPhone: data.parentPhone || '',
        block: data.block || '',
        password: data.password || '',
        createdAt: data.createdAt || ''
      };
    });

    let pendingStudentsList: any[] = [];
    try {
      const qPending = query(collection(db, 'pending_students'), where('className', '==', className));
      const pendingSnap = await getDocs(qPending);
      pendingStudentsList = pendingSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          personalEmail: data.personalEmail || '',
          role: 'student',
          status: 'pending',
          dob: data.dob || '',
          className: data.className || className,
          schoolInfo: data.schoolInfo || '',
          address: data.address || '',
          zalo: data.zalo || '',
          facebook: data.facebook || '',
          parentName: data.parentName || '',
          parentRelation: data.parentRelation || '',
          parentPhone: data.parentPhone || '',
          block: data.block || '',
          plainPassword: data.plainPassword || data.password || '',
          password: data.plainPassword || data.password || '',
          createdAt: data.createdAt || ''
        };
      });
    } catch (pErr) {
      console.warn("Could not fetch pending students during cover sync:", pErr);
    }

    const fullList = [...activeStudentsList, ...pendingStudentsList];
    fullList.sort((a: any, b: any) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      const getFirstName = (fullName: string) => {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1] || '';
      };
      const fnameA = getFirstName(nameA);
      const fnameB = getFirstName(nameB);
      const comp = fnameA.localeCompare(fnameB, 'vi');
      if (comp !== 0) return comp;
      return nameA.localeCompare(nameB, 'vi');
    });

    await setDoc(doc(db, 'class_students_cover', className), {
      className,
      students: fullList,
      lastUpdated: Date.now()
    }, { merge: true });

    return fullList;
  } catch (error) {
    console.error("Error syncing class students cover:", error);
    return [];
  }
};

export const deleteKnowledgeMetadata = async (knowledgeId: string) => {
  if (!knowledgeId) return;
  try {
    await deleteDoc(doc(db, 'knowledges_metadata', knowledgeId));
  } catch (err) {
    console.error("Error deleting knowledge metadata:", err);
  }
};

export const syncClassDashboardCover = async (className: string) => {
  if (!className) return null;
  className = className.trim();
  try {
    let block = className.match(/^(\d+)/)?.[1] || '';
    const classQ = query(collection(db, 'classes'), where('name', '==', className));
    const classDocs = await getDocs(classQ);
    if (!classDocs.empty) {
      block = classDocs.docs[0].data().block || block;
    }

    const qExams = query(
      collection(db, 'exams'),
      where('assignedClasses', 'array-contains', className)
    );
    const examSnap = await getDocs(qExams);
    const examsList = examSnap.docs
      .filter(doc => doc.data().status === 'published')
      .map(doc => {
      const data = doc.data();
      return { id: doc.id, title: data.title, duration: data.duration, startTime: data.startTime, endTime: data.endTime, assignedClasses: data.assignedClasses, teacherId: data.teacherId, createdAt: data.createdAt, status: data.status };
    });

    const qEssays = query(
      collection(db, 'essays'),
      where('assignedClasses', 'array-contains', className)
    );
    const essaySnap = await getDocs(qEssays);
    const essaysList = essaySnap.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, title: data.title, startTime: data.startTime, endTime: data.endTime, assignedClasses: data.assignedClasses, teacherId: data.teacherId, createdAt: data.createdAt };
    });

    const knowledgesMap = new Map();
    
    // 1. Fetch knowledges assigned specifically to this class
    const qKnowledgesClass = query(collection(db, 'knowledges'), where('className', '==', className));
    const knowledgeClassSnap = await getDocs(qKnowledgesClass);
    knowledgeClassSnap.docs.forEach(doc => {
      const data = doc.data();
      knowledgesMap.set(doc.id, { id: doc.id, title: data.title, block: data.block, className: data.className, fileUrl: data.fileUrl, createdAt: data.createdAt, teacherId: data.teacherId });
    });

    // 2. Fetch knowledges assigned to the entire block (where className is empty/Khác)
    if (block) {
      const qKnowledgesBlock = query(collection(db, 'knowledges'), where('block', '==', block));
      const knowledgeBlockSnap = await getDocs(qKnowledgesBlock);
      knowledgeBlockSnap.docs.forEach(doc => {
        const data = doc.data();
        const kClass = (data.className || '').trim();
        // If it's a general block knowledge (className is empty or just generic), add it.
        // If className is exactly className, it's already added above.
        if (!kClass || kClass === className) {
          knowledgesMap.set(doc.id, { id: doc.id, title: data.title, block: data.block, className: data.className, fileUrl: data.fileUrl, createdAt: data.createdAt, teacherId: data.teacherId });
        }
      });
    }
    const knowledgesList = Array.from(knowledgesMap.values());

    const coverData = {
      className,
      exams: examsList,
      essays: essaysList,
      knowledges: knowledgesList,
      lastUpdated: Date.now()
    };

    try {
      await setDoc(doc(db, 'class_dashboard_cover', className), coverData, { merge: true });
    } catch (writeErr) {
      console.warn("Could not save class dashboard cover (likely student permission), returning fetched data.", writeErr);
    }
    
    return coverData;
  } catch (error) {
    console.error("Error syncing class dashboard cover:", error);
    return null;
  }
};

export const fetchClassDataDirectly = async (className: string) => {
  if (!className) return { exams: [], knowledges: [], essays: [] };
  className = className.trim();
  
  try {
    const coverDoc = await getDoc(doc(db, 'class_dashboard_cover', className));
    if (coverDoc.exists()) {
      return coverDoc.data();
    }
  } catch (error) {
    console.warn("Could not read class_dashboard_cover:", error);
  }

  // Fallback to direct queries if cover doesn't exist or failed to read
  try {
    let block = className.match(/^(\d+)/)?.[1] || '';
    try {
      const classQ = query(collection(db, 'classes'), where('name', '==', className));
      const classDocs = await getDocs(classQ);
      if (!classDocs.empty) {
        block = classDocs.docs[0].data().block || block;
      }
    } catch (e) {
      console.warn("Error fetching class block, using prefix:", e);
    }

    const qExams = query(
      collection(db, 'exams'),
      where('assignedClasses', 'array-contains', className)
    );
    let examsList = [];
    try {
      const examSnap = await getDocs(qExams);
      examsList = examSnap.docs
        .filter(doc => doc.data().status === 'published')
        .map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("Error fetching exams:", e);
    }

    const qEssays = query(
      collection(db, 'essays'),
      where('assignedClasses', 'array-contains', className)
    );
    let essaysList = [];
    try {
      const essaySnap = await getDocs(qEssays);
      essaysList = essaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("Error fetching essays:", e);
    }

    const knowledgesMap = new Map();
    try {
      const qKnowledgesClass = query(collection(db, 'knowledges'), where('className', '==', className));
      const knowledgeClassSnap = await getDocs(qKnowledgesClass);
      knowledgeClassSnap.docs.forEach(doc => knowledgesMap.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("Error fetching class knowledges:", e);
    }

    if (block) {
      try {
        const qKnowledgesBlock = query(collection(db, 'knowledges'), where('block', '==', block));
        const knowledgeBlockSnap = await getDocs(qKnowledgesBlock);
        knowledgeBlockSnap.docs.forEach(doc => {
          const data = doc.data();
          const kClass = (data.className || '').trim();
          if (!kClass || kClass === className) {
            knowledgesMap.set(doc.id, { id: doc.id, ...data });
          }
        });
      } catch (e) {
        console.warn("Error fetching block knowledges:", e);
      }
    }
    
    return {
      className,
      exams: examsList,
      essays: essaysList,
      knowledges: Array.from(knowledgesMap.values())
    };
  } catch (error) {
    console.error("Critical error in fetchClassDataDirectly fallback:", error);
    return { exams: [], knowledges: [], essays: [] };
  }
};

export const syncClassSummary = async (className: string) => {
  return await syncClassDashboardCover(className);
};
