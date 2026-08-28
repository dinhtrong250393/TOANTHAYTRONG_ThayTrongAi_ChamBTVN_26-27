import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, syncTeacherSummary, syncExamsCover, syncEssaysCover, syncKnowledgesCover } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateEmail, updatePassword, deleteUser } from 'firebase/auth';
import firebaseConfigRaw from '../../firebase-applet-config.json';
import { Link } from 'react-router-dom';
import { Plus, Users, FileText, LogOut, Edit, Trash2, Upload, X, AlertTriangle, Clock, MessageCircle, RefreshCw, AlertCircle, CheckCircle, BookOpen, Trophy, Medal, Award, Loader2, Edit2, Calculator, Send, ArrowRightLeft, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { syncClassSummary, saveExamMetadata, saveEssayMetadata, saveKnowledgeMetadata, deleteExamMetadata, deleteEssayMetadata, deleteKnowledgeMetadata, syncClassStudentsCover, syncClassDashboardCover } from '../lib/syncUtils';
import { triggerZaloCampaign } from "../lib/zaloUtils";

const firebaseConfig = {
  ...firebaseConfigRaw,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigRaw.apiKey
};

// Secondary app for creating users without logging out the main user
const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

interface TeacherDashboardCache {
  exams: any[] | null;
  essays: any[] | null;
  knowledges: any[] | null;
  teacherClasses: any[] | null;
  availableClasses: string[] | null;
  activeClass: string | null;
  essaySubmissionsCounts: Record<string, number> | null;
  students: any[] | null;
  activeTab: 'exams' | 'students' | 'facebook' | 'knowledge' | 'classes' | 'essays' | null;
  expandedExamBlock?: string | null;
  expandedEssayBlock?: string | null;
  hasFetched?: boolean;
}

const dashboardCache: TeacherDashboardCache = {
  exams: null,
  essays: null,
  knowledges: null,
  teacherClasses: null,
  availableClasses: null,
  activeClass: null,
  essaySubmissionsCounts: null,
  students: null,
  activeTab: null,
  expandedExamBlock: null,
  expandedEssayBlock: null,
  hasFetched: false,
};

export default function TeacherDashboard() {
  const { appUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'exams' | 'students' | 'facebook' | 'knowledge' | 'classes' | 'essays'>(
    dashboardCache.activeTab || 'exams'
  );
  const [expandedExamBlock, setExpandedExamBlock] = useState<string | null>(dashboardCache.expandedExamBlock || null);
  const [expandedEssayBlock, setExpandedEssayBlock] = useState<string | null>(dashboardCache.expandedEssayBlock || null);
  
  // Classes state
  const [teacherClasses, setTeacherClasses] = useState<any[]>(dashboardCache.teacherClasses || []);
  const [newClass, setNewClass] = useState({ name: '', block: '10', zaloLink: '' });
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [editClassData, setEditClassData] = useState({ name: '', block: '10', zaloLink: '' });
  const [isUpdatingClass, setIsUpdatingClass] = useState(false);

  // Exams state
  const [exams, setExams] = useState<any[]>(dashboardCache.exams || []);
  
  // Essays state
  const [essays, setEssays] = useState<any[]>(dashboardCache.essays || []);
  const [essayToDelete, setEssayToDelete] = useState<string | null>(null);

  // Knowledge state
  const [knowledges, setKnowledges] = useState<any[]>(dashboardCache.knowledges || []);
  const [newKnowledge, setNewKnowledge] = useState({ title: '', block: '10', className: '', fileUrl: '' });
  const [isCreatingKnowledge, setIsCreatingKnowledge] = useState(false);
  const [knowledgeToDelete, setKnowledgeToDelete] = useState<string | null>(null);
  const [editingKnowledge, setEditingKnowledge] = useState<any>(null);
  const [isUpdatingKnowledge, setIsUpdatingKnowledge] = useState(false);

  // Students state
  const [students, setStudents] = useState<any[]>(dashboardCache.students || []);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', password: '', className: '', facebook: '' });
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [showCreateStudentForm, setShowCreateStudentForm] = useState(false);
  
  const [isImporting, setIsImporting] = useState(false);
  const [viewingStudentExams, setViewingStudentExams] = useState<any>(null);
  const [viewingStudentDetails, setViewingStudentDetails] = useState<any>(null);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editStudentData, setEditStudentData] = useState({ 
    name: '', 
    className: '', 
    email: '', 
    password: '',
    dob: '',
    schoolInfo: '',
    address: '',
    zalo: '',
    facebook: '',
    parentName: '',
    parentRelation: '',
    parentPhone: ''
  });
  const [updateStudentError, setUpdateStudentError] = useState('');
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [editingFbStudent, setEditingFbStudent] = useState<any>(null);
  const [editFbData, setEditFbData] = useState({ facebook: '', zalo: '' });
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [studentToTransfer, setStudentToTransfer] = useState<any>(null);
  const [targetTransferClass, setTargetTransferClass] = useState<string>('');
  const [isTransferringStudent, setIsTransferringStudent] = useState(false);
  const [transferStudentError, setTransferStudentError] = useState('');
  const [syncingClassCover, setSyncingClassCover] = useState<string | null>(null);
  const [syncingDashboardCover, setSyncingDashboardCover] = useState<string | null>(null);
  const [syncedDashboardCovers, setSyncedDashboardCovers] = useState<Set<string>>(new Set());
  const [notifyModalItem, setNotifyModalItem] = useState<{id: string, type: 'exam' | 'essay', title: string, duration?: number, startTime?: string, endTime?: string, assignedClasses?: string[]} | null>(null);
  const [selectedNotifyClass, setSelectedNotifyClass] = useState<string>('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [examToExtend, setExamToExtend] = useState<any>(null);
  const [rankingExam, setRankingExam] = useState<any>(null);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [newEndTime, setNewEndTime] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingStudentId, setAcceptingStudentId] = useState<string | null>(null);
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);
  const [syncingEssayId, setSyncingEssayId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeClass, setActiveClass] = useState<string>(dashboardCache.activeClass || '');
  const [availableClasses, setAvailableClasses] = useState<string[]>(dashboardCache.availableClasses || []);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [essayToExtend, setEssayToExtend] = useState<any>(null);
  const [essaySubmissionsCounts, setEssaySubmissionsCounts] = useState<Record<string, number>>(dashboardCache.essaySubmissionsCounts || {});

  useEffect(() => {
    if (!rankingExam) {
      setRankingData([]);
      return;
    }

    const fetchRankingData = async () => {
      setIsLoadingRanking(true);
      try {
        let summary = rankingExam.submissionSummary || [];

        if (rankingExam.isEssay) {
          if (rankingExam.submissionSummary && rankingExam.submissionSummary.length > 0) {
            summary = rankingExam.submissionSummary
              .filter((s: any) => s.score !== undefined && s.score !== null)
              .map((s: any) => ({
                submissionId: s.id,
                studentId: s.studentId,
                studentName: s.studentName,
                score: s.score,
                submittedAt: s.submittedAt
              }));
          } else {
            const q = query(collection(db, 'essay_submissions'), where('essayId', '==', rankingExam.id));
            const snap = await getDocs(q);
            const subs = snap.docs.map(doc => {
              const data = doc.data();
              return {
                submissionId: doc.id,
                studentId: data.studentId,
                studentName: data.studentName,
                score: data.score,
                submittedAt: data.submittedAt
              };
            });
            summary = subs.filter(s => s.score !== undefined && s.score !== null);
          }
        }

        if (summary.length === 0) {
          setRankingData([]);
          return;
        }

        const map = new Map();
        summary.forEach((sub: any) => {
          const key = sub.studentId || sub.studentName || sub.submissionId;
          if (!map.has(key)) {
            map.set(key, sub);
          } else {
            const existing = map.get(key);
            const subScore = parseFloat(sub.score || '0');
            const existingScore = parseFloat(existing.score || '0');
            if (subScore > existingScore) {
              map.set(key, sub);
            } else if (subScore === existingScore) {
              const subDate = new Date(sub.submittedAt).getTime();
              const existingDate = new Date(existing.submittedAt).getTime();
              if (subDate < existingDate) {
                map.set(key, sub);
              }
            }
          }
        });

        const topStudents = Array.from(map.values()).sort((a: any, b: any) => {
          const scoreA = parseFloat(a.score || '0');
          const scoreB = parseFloat(b.score || '0');
          if (scoreB !== scoreA) return scoreB - scoreA;
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        }).slice(0, 5);

        // Fetch names if missing or generic
        const processedStudents = await Promise.all(topStudents.map(async (sub) => {
          let studentName = sub.studentName;
          
          if ((!studentName || studentName === 'Học sinh' || studentName === 'Học sinh ẩn danh') && sub.studentId) {
            // Check local students array first
            const foundLocal = students.find((s: any) => s.uid === sub.studentId || s.id === sub.studentId);
            if (foundLocal && foundLocal.name) {
              studentName = foundLocal.name;
            } else {
               // Fetch from DB
               try {
                 const userDoc = await getDoc(doc(db, 'users', sub.studentId));
                 if (userDoc.exists() && userDoc.data().name) {
                   studentName = userDoc.data().name;
                 }
               } catch(e) {
                 console.log("Error fetching student name", e);
               }
            }
          }
          if (!studentName) studentName = 'Học sinh ẩn danh';
          
          return { ...sub, studentName };
        }));

        setRankingData(processedStudents);
      } catch (e) {
        console.error("Error processing ranking:", e);
      } finally {
        setIsLoadingRanking(false);
      }
    };

    fetchRankingData();
  }, [rankingExam, students]);

  const [isSyncingClass, setIsSyncingClass] = useState(false);

  const handleManualSyncClass = async () => {
    if (!activeClass) return;
    setIsSyncingClass(true);
    try {
      const fullList = await syncClassStudentsCover(activeClass);
      setStudents(fullList);
      alert(`Đã cập nhật Tờ bìa học sinh lớp ${activeClass} thành công! (Tổng số: ${fullList.length} học sinh)`);
    } catch (err) {
      console.error(err);
      alert('Cập nhật Tờ bìa lớp thất bại.');
    } finally {
      setIsSyncingClass(false);
    }
  };

  const fetchData = async (forceSync: boolean | any = false) => {
    if (!appUser?.uid) return;

    // Check LocalStorage TTL Cache (2 minutes) to prevent F5 quota spam
    const cacheKey = `teacher_dashboard_cache_${appUser.uid}`;
    if (!forceSync) {
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          const cachedData = JSON.parse(cachedStr);
          const isExpired = new Date().getTime() - cachedData.timestamp > 10 * 1000; // 10 seconds cache
          if (!isExpired) {
            setExams(cachedData.examsList || []);
            setEssays(cachedData.essaysList || []);
            setKnowledges(cachedData.knowledgesList || []);
            setTeacherClasses(cachedData.classesList || []);
            setAvailableClasses(cachedData.classesArray || []);
            if (cachedData.classesArray && cachedData.classesArray.length > 0 && !activeClass) {
              setActiveClass(cachedData.classesArray[0]);
            }
            setEssaySubmissionsCounts(cachedData.counts || {});
            setSubmissions([]);
            dashboardCache.hasFetched = true;
            return; // Cache hit, exit early
          }
        }
      } catch (e) {
        console.warn("Could not read dashboard cache", e);
      }
    }

    setIsRefreshing(true);
    setError(null);
    try {
      let examsList = [];
      let knowledgesList = [];
      let essaysList = [];

      // 1. Fetch Exams Cover Sheet (1 Read instead of query!)
      let examsCoverDoc = null;
      if (!forceSync) {
        examsCoverDoc = await getDoc(doc(db, 'teachers_exams_cover', appUser.uid));
      }
      if (examsCoverDoc && examsCoverDoc.exists() && examsCoverDoc.data().examsList && examsCoverDoc.data().examsList.length > 0) {
        examsList = examsCoverDoc.data().examsList;
        // Check if old schema is used (missing status property)
        if (examsList.length > 0 && !('status' in examsList[0])) {
          examsList = await syncExamsCover(appUser.uid);
        }
      } else {
        // Fallback or Force Sync: fetch all and sync
        examsList = await syncExamsCover(appUser.uid);
      }

      // 2. Fetch Essays Cover Sheet (1 Read!)
      let essaysCoverDoc = null;
      if (!forceSync) {
        essaysCoverDoc = await getDoc(doc(db, 'teachers_essays_cover', appUser.uid));
      }
      if (essaysCoverDoc && essaysCoverDoc.exists() && essaysCoverDoc.data().essaysList && essaysCoverDoc.data().essaysList.length > 0) {
        essaysList = essaysCoverDoc.data().essaysList;
        // Check if old schema is used
        if (essaysList.length > 0 && !('status' in essaysList[0])) {
          essaysList = await syncEssaysCover(appUser.uid);
        }
      } else {
        essaysList = await syncEssaysCover(appUser.uid);
      }

      // 3. Fetch Knowledges Cover Sheet (1 Read!)
      let knowledgesCoverDoc = null;
      if (!forceSync) {
        knowledgesCoverDoc = await getDoc(doc(db, 'teachers_knowledges_cover', appUser.uid));
      }
      if (knowledgesCoverDoc && knowledgesCoverDoc.exists() && knowledgesCoverDoc.data().knowledgesList && knowledgesCoverDoc.data().knowledgesList.length > 0) {
        knowledgesList = knowledgesCoverDoc.data().knowledgesList;
      } else {
        knowledgesList = await syncKnowledgesCover(appUser.uid);
      }
      
      // Sort exams by number in title
      examsList.sort((a: any, b: any) => {
        const titleA = a.title || '';
        const titleB = b.title || '';
        
        const matchA = titleA.match(/\d+/);
        const matchB = titleB.match(/\d+/);
        
        if (matchA && matchB) {
          const numA = parseInt(matchA[0], 10);
          const numB = parseInt(matchB[0], 10);
          if (numA !== numB) {
            return numA - numB;
          }
        }
        
        return titleA.localeCompare(titleB);
      });
      
      setExams(examsList);

      // Sort essays by number in title
      essaysList.sort((a: any, b: any) => {
        const titleA = a.title || '';
        const titleB = b.title || '';
        
        const matchA = titleA.match(/\d+/);
        const matchB = titleB.match(/\d+/);
        
        if (matchA && matchB) {
          const numA = parseInt(matchA[0], 10);
          const numB = parseInt(matchB[0], 10);
          if (numA !== numB) {
            return numA - numB;
          }
        }
        return titleA.localeCompare(titleB);
      });
      setEssays(essaysList);

      // Fetch submissions count for each essay from de-normalized data
      const counts: Record<string, number> = {};
      essaysList.forEach((essay: any) => {
        counts[essay.id] = essay.submissionSummary?.length || 0;
      });
      setEssaySubmissionsCounts(counts);

      knowledgesList.sort((a: any, b: any) => {
        const blockA = parseInt(a.block || '0', 10);
        const blockB = parseInt(b.block || '0', 10);
        if (blockA !== blockB) return blockA - blockB;

        const titleA = a.title || '';
        const titleB = b.title || '';
        
        const getChapter = (title: string) => {
          const match = title.match(/chương\s*(\d+|[IVXLCDM]+)/i);
          if (!match) return 0;
          const val = match[1].toUpperCase();
          if (/^\d+$/.test(val)) return parseInt(val, 10);
          
          const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
          let result = 0;
          for (let i = 0; i < val.length; i++) {
              const curr = romanMap[val[i]];
              const next = romanMap[val[i + 1]];
              if (next > curr) {
                  result += next - curr;
                  i++;
              } else {
                  result += curr;
              }
          }
          return result;
        };
      
        const getLesson = (title: string) => {
          const match = title.match(/bài\s*(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        };
        
        const chapterA = getChapter(titleA);
        const chapterB = getChapter(titleB);
        
        if (chapterA !== chapterB) {
          return chapterA - chapterB;
        }
        
        const lessonA = getLesson(titleA);
        const lessonB = getLesson(titleB);
        
        if (lessonA !== lessonB) {
          return lessonA - lessonB;
        }
        
        return titleA.localeCompare(titleB, 'vi', { numeric: true, sensitivity: 'base' });
      });
      setKnowledges(knowledgesList);

      // Derive available classes from explicitly created classes only
      const classes = new Set<string>();
      
      // Fetch classes
      const qClasses = query(collection(db, 'classes'), where('teacherId', '==', appUser.uid));
      const classesSnap = await getDocs(qClasses);
      const classesList = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      classesList.sort((a: any, b: any) => {
        if (a.block !== b.block) return a.block.localeCompare(b.block);
        return a.name.localeCompare(b.name);
      });
      setTeacherClasses(classesList);
      
      classesList.forEach(cls => classes.add((cls as any).name));
      const classesArray = Array.from(classes).sort();
      setAvailableClasses(classesArray);
      
      if (classesArray.length > 0 && !activeClass) {
        setActiveClass(classesArray[0]);
      }

      // Removed global students fetch to save Firebase Quota
      // We will only fetch students per-class when a specific class is selected
      // setStudents(studentsList);
      
      // Removed global submissions fetch to save Firebase Quota
      // Submissions will only be fetched per-exam in ExamResults.tsx
      setSubmissions([]);
      
      try {
        localStorage.setItem(`teacher_dashboard_cache_${appUser.uid}`, JSON.stringify({
          timestamp: new Date().getTime(),
          examsList,
          essaysList,
          knowledgesList,
          classesList,
          classesArray,
          counts
        }));
      } catch (e) {
        console.warn("Could not save dashboard cache", e);
      }
      
      dashboardCache.hasFetched = true;
    } catch (err: any) {
      console.error("Error fetching data:", err);
      if (err.message && err.message.includes('Quota')) {
        setError('Hệ thống đang quá tải (vượt quá giới hạn truy cập miễn phí của Firebase). Vui lòng thử lại sau.');
      } else {
        // Do not display generic error to user
        // setError('Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!dashboardCache.hasFetched) {
      fetchData();
    }
  }, [appUser?.uid]);

  // Sync state to global cache to survive page transition / back navigation
  useEffect(() => {
    dashboardCache.exams = exams;
    dashboardCache.essays = essays;
    dashboardCache.knowledges = knowledges;
    dashboardCache.teacherClasses = teacherClasses;
    dashboardCache.availableClasses = availableClasses;
    dashboardCache.activeClass = activeClass;
    dashboardCache.essaySubmissionsCounts = essaySubmissionsCounts;
    dashboardCache.students = students;
    dashboardCache.activeTab = activeTab;
  }, [exams, essays, knowledges, teacherClasses, availableClasses, activeClass, essaySubmissionsCounts, students, activeTab]);

  const fetchStudentsForClass = async (className: string, forceDirect = false) => {
    if (!className) return;
    setIsFetchingStudents(true);
    try {
      if (!forceDirect) {
        try {
          const coverRef = doc(db, 'class_students_cover', className);
          const coverSnap = await getDoc(coverRef);
          if (coverSnap.exists() && Array.isArray(coverSnap.data().students) && coverSnap.data().students.length > 0) {
            setStudents(coverSnap.data().students);
            setIsFetchingStudents(false);
            return;
          }
        } catch (coverErr) {
          console.warn("Could not read class_students_cover, falling back to direct query:", coverErr);
        }
      }

      const qStudents = query(collection(db, 'users'), where('className', '==', className));
      const studentSnap = await getDocs(qStudents);
      const activeStudentsList = studentSnap.docs
        .filter(doc => doc.data().role === 'student')
        .map(doc => ({ id: doc.id, ...doc.data(), status: doc.data().status || 'active' }));

      let pendingStudentsList: any[] = [];
      try {
        const qPending = query(collection(db, 'pending_students'), where('className', '==', className));
        const pendingSnap = await getDocs(qPending);
        pendingStudentsList = pendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), status: 'pending' }));
      } catch (pendingErr) {
        console.error("Error fetching pending students:", pendingErr);
      }

      const studentsList = [...activeStudentsList, ...pendingStudentsList];
      studentsList.sort((a: any, b: any) => {
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
      setStudents(studentsList);
      syncClassStudentsCover(className);
    } catch (error) {
      console.error("Error fetching students for class:", error);
    } finally {
      setIsFetchingStudents(false);
    }
  };

  const isInitialStudentsMount = React.useRef(true);

  useEffect(() => {
    if (isInitialStudentsMount.current) {
      isInitialStudentsMount.current = false;
      if (dashboardCache.exams !== null) {
        // Skip fetching on initial mount when navigating back (use cached students)
        return;
      }
    }
    if (activeClass && (activeTab === 'students' || activeTab === 'facebook')) {
      fetchStudentsForClass(activeClass);
    }
  }, [activeClass, activeTab]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStudent(true);
    setStudentError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStudent.email, newStudent.password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: newStudent.email,
        name: newStudent.name,
        className: newStudent.className,
        password: newStudent.password,
        role: 'student',
        createdAt: new Date().toISOString()
      });
      await signOut(secondaryAuth);
      if (newStudent.className === activeClass) {
        fetchStudentsForClass(activeClass);
      }
      setNewStudent({ name: '', email: '', password: '', className: '', facebook: '' });
      alert('Tạo học sinh thành công!');
    } catch (error: any) {
      console.error("Error creating student:", error);
      if (error.code === 'auth/email-already-in-use') {
        try {
          // Attempt to recover by signing in if the account exists but Firestore doc was deleted
          const signInCredential = await signInWithEmailAndPassword(secondaryAuth, newStudent.email, newStudent.password);
          const existingUserSnap = await getDoc(doc(db, 'users', signInCredential.user.uid));
          let finalCreatedAt = new Date().toISOString();
          if (existingUserSnap.exists() && existingUserSnap.data().createdAt) {
              finalCreatedAt = existingUserSnap.data().createdAt;
          }
          await setDoc(doc(db, 'users', signInCredential.user.uid), {
            uid: signInCredential.user.uid,
            email: newStudent.email,
            name: newStudent.name,
            className: newStudent.className,
            password: newStudent.password,
            role: 'student',
            createdAt: finalCreatedAt
          });
          await signOut(secondaryAuth);
          if (newStudent.className === activeClass) {
            fetchStudentsForClass(activeClass);
          }
          setNewStudent({ name: '', email: '', password: '', className: '', facebook: '' });
          alert('Tài khoản đã tồn tại trong hệ thống. Đã khôi phục và cập nhật hồ sơ học sinh thành công!');
        } catch (signInError) {
          setStudentError('Email này đã được sử dụng và mật khẩu không khớp để khôi phục.');
        }
      } else if (error.code === 'auth/operation-not-allowed') {
        setStudentError('LỖI NGHIÊM TRỌNG: Bạn CHƯA BẬT chức năng đăng nhập bằng Email/Mật khẩu trên Firebase! Vui lòng vào Firebase Console -> Authentication -> Sign-in method -> Bật "Email/Password".');
        alert('LỖI NGHIÊM TRỌNG: Bạn CHƯA BẬT chức năng đăng nhập bằng Email/Mật khẩu trên Firebase!\n\nVui lòng làm theo hướng dẫn:\n1. Vào Firebase Console\n2. Chọn Authentication -> Sign-in method\n3. Bật "Email/Password"\n4. Lưu lại và thử lại.');
      } else if (error.code === 'auth/invalid-email') {
        setStudentError('Địa chỉ email không hợp lệ (phải có dạng ten@mien.com).');
      } else if (error.code === 'auth/weak-password') {
        setStudentError('Mật khẩu quá yếu (phải có ít nhất 6 ký tự).');
      } else if (error.code === 'auth/invalid-credential') {
        setStudentError('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại email và mật khẩu.');
      } else {
        setStudentError('Lỗi: ' + error.message);
      }
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStudentError('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        let successCount = 0;
        let errorCount = 0;
        let isOperationNotAllowed = false;
        let emailInUseCount = 0;
        let invalidEmailCount = 0;
        let weakPasswordCount = 0;
        let missingDataCount = 0;
        let wrongPasswordCount = 0;
        let otherErrorMessages: string[] = [];

        for (const row of json) {
          const name = row['FullName'] || row['Họ và tên'];
          const className = row['Class'] || row['Lớp'];
          const email = row['Email']?.toString().trim();
          const password = row['Password'] || row['Mật khẩu'];
          const facebook = row['Facebook'] || row['FB'] || row['Link Facebook'] || '';
          const zalo = row['Zalo'] || row['SĐT Zalo'] || row['Số điện thoại'] || row['Phone'] || '';
          const role = row['Role'];

          // Skip if role is explicitly set to something other than student
          if (role && String(role).toLowerCase() !== 'student') {
            continue;
          }

          if (name && className && email && password) {
            try {
              const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, String(password));
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: email,
                name: String(name).trim(),
                className: String(className).trim(),
                password: String(password),
                facebook: String(facebook).trim(),
                zalo: String(zalo).trim(),
                role: 'student',
                createdAt: new Date().toISOString()
              });
              await signOut(secondaryAuth);
              successCount++;
            } catch (err: any) {
              if (err.code === 'auth/email-already-in-use') {
                try {
                  // Attempt to recover by signing in
                  const signInCredential = await signInWithEmailAndPassword(secondaryAuth, email, String(password));
                  const existingUserSnap = await getDoc(doc(db, 'users', signInCredential.user.uid));
                  let finalCreatedAt = new Date().toISOString();
                  if (existingUserSnap.exists() && existingUserSnap.data().createdAt) {
                      finalCreatedAt = existingUserSnap.data().createdAt;
                  }
                  await setDoc(doc(db, 'users', signInCredential.user.uid), {
                    uid: signInCredential.user.uid,
                    email: email,
                    name: String(name).trim(),
                    className: String(className).trim(),
                    password: String(password),
                    facebook: String(facebook).trim(),
                    zalo: String(zalo).trim(),
                    role: 'student',
                    createdAt: finalCreatedAt
                  });
                  await signOut(secondaryAuth);
                  successCount++;
                } catch (signInErr: any) {
                  console.error("Lỗi khôi phục tài khoản cho", email, signInErr);
                  if (signInErr.code === 'auth/wrong-password' || signInErr.code === 'auth/invalid-credential') {
                    wrongPasswordCount++;
                  } else {
                    emailInUseCount++;
                  }
                  errorCount++;
                }
              } else {
                console.error("Lỗi tạo tài khoản cho", email, err);
                if (err.code === 'auth/operation-not-allowed') {
                  isOperationNotAllowed = true;
                } else if (err.code === 'auth/invalid-email') {
                  invalidEmailCount++;
                } else if (err.code === 'auth/weak-password') {
                  weakPasswordCount++;
                } else {
                  otherErrorMessages.push(`${email}: ${err.message}`);
                }
                errorCount++;
              }
            }
          } else {
            missingDataCount++;
            errorCount++;
          }
        }
        
        if (isOperationNotAllowed) {
          alert('LỖI NGHIÊM TRỌNG: Bạn CHƯA BẬT chức năng đăng nhập bằng Email/Mật khẩu trên Firebase!\n\nVui lòng làm theo hướng dẫn:\n1. Vào Firebase Console\n2. Chọn Authentication -> Sign-in method\n3. Bật "Email/Password"\n4. Lưu lại và thử lại.');
          setStudentError('Vui lòng bật Email/Password trong Firebase Console (Authentication -> Sign-in method).');
        } else {
          let msg = `Nhập thành công: ${successCount} học sinh.\n`;
          if (errorCount > 0) {
            msg += `Thất bại: ${errorCount} dòng.\nChi tiết lỗi:\n`;
            if (emailInUseCount > 0) msg += `- ${emailInUseCount} email đã tồn tại.\n`;
            if (wrongPasswordCount > 0) msg += `- ${wrongPasswordCount} email đã tồn tại nhưng sai mật khẩu (không thể cập nhật).\n`;
            if (invalidEmailCount > 0) msg += `- ${invalidEmailCount} email không hợp lệ (sai định dạng).\n`;
            if (weakPasswordCount > 0) msg += `- ${weakPasswordCount} mật khẩu quá yếu (dưới 6 ký tự).\n`;
            if (missingDataCount > 0) msg += `- ${missingDataCount} dòng thiếu dữ liệu (tên, lớp, email hoặc mật khẩu).\n`;
            if (otherErrorMessages.length > 0) {
              msg += `- Lỗi khác:\n  + ${otherErrorMessages.slice(0, 3).join('\n  + ')}`;
              if (otherErrorMessages.length > 3) msg += `\n  + ... và ${otherErrorMessages.length - 3} lỗi khác.`;
            }
          }
          alert(msg);
          if (activeClass) {
            fetchStudentsForClass(activeClass);
          }
        }
      } catch (err: any) {
        setStudentError('Lỗi đọc file Excel: ' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Reset file input
      }
    };
    reader.onerror = () => {
      setStudentError('Lỗi đọc file.');
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAcceptStudent = async (studentId: string) => {
    if (acceptingStudentId) return;
    setAcceptingStudentId(studentId);
    try {
      // Find the student in the students state
      const pendingStudent = students.find(s => s.id === studentId);
      if (!pendingStudent) {
        alert('Không tìm thấy thông tin đăng ký!');
        setAcceptingStudentId(null);
        return;
      }

      const rawPassword = pendingStudent.plainPassword || pendingStudent.password || '123456@';

      let uid = '';
      try {
        // Create authentication in Firebase Auth using the global secondaryAuth
        const cred = await createUserWithEmailAndPassword(secondaryAuth, pendingStudent.email, rawPassword);
        uid = cred.user.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          try {
            // Retrieve existing credentials by signing in
            const cred = await signInWithEmailAndPassword(secondaryAuth, pendingStudent.email, rawPassword);
            uid = cred.user.uid;
          } catch (signInErr: any) {
            console.error("Auth merge error:", signInErr);
            if (signInErr.code === 'auth/wrong-password' || signInErr.code === 'auth/invalid-credential') {
              const namePart = pendingStudent.email.split('@')[0];
              const randomSuffix = Math.floor(Math.random() * 10000);
              const newEmail = `${namePart}${randomSuffix}@gmail.com`;
              
              try {
                const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, rawPassword);
                uid = cred.user.uid;
                pendingStudent.email = newEmail;
                alert(`⚠️ LƯU Ý QUAN TRỌNG ⚠️\n\nTài khoản cũ của học sinh bị kẹt mật khẩu không thể khôi phục. Hệ thống đã tự động tạo email mới:\n\n👉 Email mới: ${newEmail}\n👉 Mật khẩu: ${rawPassword}\n\nHãy copy và gửi lại cho học sinh thông tin này để đăng nhập!`);
              } catch (fallbackErr: any) {
                throw new Error(`Không thể tạo tài khoản thay thế: ${fallbackErr.message}`);
              }
            } else {
              throw new Error(`Email này (${pendingStudent.email}) đã được sử dụng ở tài khoản khác và mật khẩu không trùng khớp để tự động liên kết.`);
            }
          }
        } else {
          throw authError;
        }
      }

      // Safe truncate to match Firestore security rules length
      const safeName = (pendingStudent.name || 'Học sinh').substring(0, 95);
      const safeClassName = (pendingStudent.className || '').substring(0, 140);
      const safeSchoolInfo = (pendingStudent.schoolInfo || '').substring(0, 140);

      // Check if user already exists to preserve createdAt
      const existingUserSnap = await getDoc(doc(db, 'users', uid));
      let finalCreatedAt = typeof pendingStudent.createdAt === 'string' ? pendingStudent.createdAt : new Date().toISOString();
      if (existingUserSnap.exists() && existingUserSnap.data().createdAt) {
          finalCreatedAt = existingUserSnap.data().createdAt;
      }

      // Create or update user document in 'users' collection with the same UID
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        name: safeName,
        email: pendingStudent.email,
        personalEmail: pendingStudent.personalEmail || '',
        role: 'student',
        status: 'active',
        dob: pendingStudent.dob || '',
        className: safeClassName,
        schoolInfo: safeSchoolInfo,
        address: pendingStudent.address || '',
        zalo: pendingStudent.zalo || '',
        facebook: pendingStudent.facebook || '',
        parentName: pendingStudent.parentName || '',
        parentRelation: pendingStudent.parentRelation || '',
        parentPhone: pendingStudent.parentPhone || '',
        block: pendingStudent.block || '10',
        password: rawPassword, // Keep password for reference
        createdAt: finalCreatedAt
      });

      // Sign out from the secondary app authentication state safely
      await signOut(secondaryAuth);

      // Delete from pending_students
      await deleteDoc(doc(db, 'pending_students', studentId));

      // Refresh local state list
      const updatedList = students.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            id: uid,
            uid: uid,
            status: 'active'
          };
        }
        return s;
      });
      setStudents(updatedList);
      if (activeClass) {
        await syncClassStudentsCover(activeClass);
      }
      alert('Đã duyệt học sinh thành công! Tài khoản và mật khẩu đã được tạo và kích hoạt.');
    } catch (error: any) {
      console.error(error);
      alert('Lỗi xác nhận học sinh: ' + error.message);
    } finally {
      setAcceptingStudentId(null);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    
    setIsUpdatingStudent(true);
    setUpdateStudentError('');
    
    try {
      const emailChanged = editStudentData.email !== editingStudent.email;
      const passwordChanged = editStudentData.password !== editingStudent.password;

      if (emailChanged || passwordChanged) {
        if (!editingStudent.password) {
          setUpdateStudentError("Không thể đổi Email/Mật khẩu vì mật khẩu cũ không được lưu trong hệ thống (tài khoản cũ). Vui lòng tạo tài khoản mới.");
          setIsUpdatingStudent(false);
          return;
        }
        
        if (passwordChanged && editStudentData.password.length < 6) {
          setUpdateStudentError("Mật khẩu mới phải có ít nhất 6 ký tự.");
          setIsUpdatingStudent(false);
          return;
        }

        try {
          let userCredential;
          try {
            userCredential = await signInWithEmailAndPassword(secondaryAuth, editingStudent.email, editingStudent.password);
          } catch (signInErr: any) {
            // Recovery: If email or password was previously updated in Auth but not Firestore
            if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/wrong-password') {
              let recovered = false;
              
              // Try 1: Old email, New password
              if (!recovered && passwordChanged) {
                try {
                  userCredential = await signInWithEmailAndPassword(secondaryAuth, editingStudent.email, editStudentData.password);
                  recovered = true;
                } catch (e) {}
              }
              
              // Try 2: New email, Old password
              if (!recovered && emailChanged) {
                try {
                  userCredential = await signInWithEmailAndPassword(secondaryAuth, editStudentData.email, editingStudent.password);
                  recovered = true;
                } catch (e) {}
              }
              
              // Try 3: New email, New password
              if (!recovered && emailChanged && passwordChanged) {
                try {
                  userCredential = await signInWithEmailAndPassword(secondaryAuth, editStudentData.email, editStudentData.password);
                  recovered = true;
                } catch (e) {}
              }
              
              if (!recovered) {
                throw signInErr; // Throw original error if all recovery attempts fail
              }
            } else {
              throw signInErr;
            }
          }
          
          if (emailChanged && userCredential.user.email !== editStudentData.email) {
            await updateEmail(userCredential.user, editStudentData.email);
          }
          if (passwordChanged) {
            // Only update password if we didn't just use it to recover the account
            const usedNewPasswordToRecover = userCredential && userCredential.user && 
              (editStudentData.password !== editingStudent.password); // We can't easily check what password was used to sign in, but if we reached here and passwordChanged is true, we should just update it to be safe.
            // Actually, updatePassword doesn't hurt if it's the same password.
            await updatePassword(userCredential.user, editStudentData.password);
          }
          
          await signOut(secondaryAuth);
        } catch (authError: any) {
          console.error("Auth update error:", authError);
          if (authError.code === 'auth/weak-password') {
            setUpdateStudentError("Mật khẩu mới quá yếu (phải có ít nhất 6 ký tự).");
          } else if (authError.code === 'auth/invalid-email') {
            setUpdateStudentError("Email mới không hợp lệ.");
          } else if (authError.code === 'auth/email-already-in-use') {
            setUpdateStudentError("Email mới đã được sử dụng bởi một tài khoản khác.");
          } else if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
            setUpdateStudentError("Không thể xác thực. Mật khẩu cũ lưu trong hệ thống không khớp với mật khẩu thực tế của tài khoản.");
          } else if (authError.code === 'auth/too-many-requests') {
            setUpdateStudentError("Quá nhiều yêu cầu. Vui lòng thử lại sau.");
          } else {
            setUpdateStudentError("Lỗi hệ thống xác thực: " + authError.message);
          }
          setIsUpdatingStudent(false);
          return;
        }
      }

      await updateDoc(doc(db, 'users', editingStudent.id), {
        name: editStudentData.name,
        className: editStudentData.className,
        email: editStudentData.email,
        password: editStudentData.password,
        dob: editStudentData.dob || '',
        schoolInfo: editStudentData.schoolInfo || '',
        address: editStudentData.address || '',
        zalo: editStudentData.zalo || '',
        facebook: editStudentData.facebook || '',
        parentName: editStudentData.parentName || '',
        parentRelation: editStudentData.parentRelation || '',
        parentPhone: editStudentData.parentPhone || ''
      });

      // Synchronize class cover so results & Zalo notification immediately get latest SĐT & Zalo
      if (editStudentData.className) {
        await syncClassStudentsCover(editStudentData.className);
      }
      if (editingStudent.className && editingStudent.className !== editStudentData.className) {
        await syncClassStudentsCover(editingStudent.className);
      }

      setEditingStudent(null);
    } catch (error: any) {
      console.error("Firestore update error:", error);
      setUpdateStudentError("Lỗi cập nhật dữ liệu: " + (error.message || "Không xác định"));
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFbStudent) return;
    try {
      await updateDoc(doc(db, 'users', editingFbStudent.id), {
        facebook: editFbData.facebook,
        zalo: editFbData.zalo
      });
      if (editingFbStudent.className) {
        await syncClassStudentsCover(editingFbStudent.className);
      }
      setEditingFbStudent(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingFbStudent.id}`);
    }
  };

  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteStudentError, setDeleteStudentError] = useState('');

  const handleTransferStudent = async () => {
    if (!studentToTransfer || !targetTransferClass) return;
    setIsTransferringStudent(true);
    setTransferStudentError('');
    try {
      const oldClass = studentToTransfer.className;
      await updateDoc(doc(db, 'users', studentToTransfer.id), {
        className: targetTransferClass
      });
      // Update class covers
      await syncClassStudentsCover(targetTransferClass);
      if (oldClass) {
        await syncClassStudentsCover(oldClass);
      }
      // Remove from current active class view
      setStudents(students.filter(s => s.id !== studentToTransfer.id));
      
      setStudentToTransfer(null);
      setTargetTransferClass('');
    } catch (err: any) {
      console.error("Error transferring student:", err);
      setTransferStudentError(err.message || 'Có lỗi xảy ra khi chuyển lớp');
    } finally {
      setIsTransferringStudent(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    setDeleteStudentError('');
    try {
      const student = students.find(s => s.id === studentToDelete);
      if (student) {
        if (student.status === 'pending') {
          await deleteDoc(doc(db, 'pending_students', studentToDelete));
          setStudents(students.filter(s => s.id !== studentToDelete));
          setStudentToDelete(null);
          if (activeClass) {
            await syncClassStudentsCover(activeClass);
          }
          return;
        }

        try {
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, student.email, student.password);
          await deleteUser(userCredential.user);
          await signOut(secondaryAuth);
        } catch (authError: any) {
          console.warn("Auth delete error (ignoring to allow Firestore deletion):", authError);
          // We ignore the auth error so the teacher can at least remove the student from the class list.
          // The Auth user might be orphaned, but without a Firestore doc, they have no access.
        }
      }

      await deleteDoc(doc(db, 'users', studentToDelete));
      setStudents(students.filter(s => s.id !== studentToDelete));
      setStudentToDelete(null);
      if (activeClass) {
        await syncClassStudentsCover(activeClass);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${studentToDelete}`);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleDeleteAllStudents = async () => {
    try {
      // In a real app, you might want to do this in batches if there are many students
      const deletePromises = students.map(student => deleteDoc(doc(db, 'users', student.id)));
      await Promise.all(deletePromises);
      setIsDeletingAll(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users`);
    }
  };

  const handleDeleteExam = async () => {
    if (!examToDelete || !appUser) return;
    try {
      const exam = exams.find(e => e.id === examToDelete);
      const classesToSync = exam?.assignedClasses || [];
      
      await deleteDoc(doc(db, 'exams', examToDelete));
      await deleteExamMetadata(examToDelete);
      await deleteDoc(doc(db, 'exam_results_cover', examToDelete)).catch(() => {});
      setExamToDelete(null);
      
      // Update local state first to make it visually faster
      const newExams = exams.filter(e => e.id !== examToDelete);
      setExams(newExams);
      
      for (const className of classesToSync) {
        await syncClassSummary(className);
      }
      
      await syncTeacherSummary(appUser.uid);
      await syncExamsCover(appUser.uid);
      
      // Update cache
      try {
        const cachedStr = localStorage.getItem(`teacher_dashboard_cache_${appUser.uid}`);
        if (cachedStr) {
          const cachedData = JSON.parse(cachedStr);
          cachedData.examsList = newExams;
          localStorage.setItem(`teacher_dashboard_cache_${appUser.uid}`, JSON.stringify(cachedData));
        }
      } catch (e) {
        console.warn("Could not update cache on exam delete", e);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exams/${examToDelete}`);
    }
  };

  const handleDeleteEssay = async () => {
    if (!essayToDelete || !appUser) return;
    try {
      const essay = essays.find(e => e.id === essayToDelete);
      const classesToSync = essay?.assignedClasses || [];

      await deleteDoc(doc(db, 'essays', essayToDelete));
      await deleteEssayMetadata(essayToDelete);
      await deleteDoc(doc(db, 'essay_results_cover', essayToDelete)).catch(() => {});
      setEssayToDelete(null);
      const newEssays = essays.filter(e => e.id !== essayToDelete);
      setEssays(newEssays);
      await syncEssaysCover(appUser.uid);
      
      for (const className of classesToSync) {
        await syncClassSummary(className);
      }
      
      // Update cache
      try {
        const cachedStr = localStorage.getItem(`teacher_dashboard_cache_${appUser.uid}`);
        if (cachedStr) {
          const cachedData = JSON.parse(cachedStr);
          cachedData.essaysList = newEssays;
          localStorage.setItem(`teacher_dashboard_cache_${appUser.uid}`, JSON.stringify(cachedData));
        }
      } catch (e) {}
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `essays/${essayToDelete}`);
    }
  };

  const handleSyncOldData = async (examId: string) => {
    setSyncingExamId(examId);
    try {
      // 1. Fetch all submissions for this exam
      const qSubmissions = query(collection(db, 'submissions'), where('examId', '==', examId));
      const subSnap = await getDocs(qSubmissions);
      const subs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Get unique submissions (latest per student)
      const map = new Map();
      subs.forEach(sub => {
        if (!map.has(sub.studentId)) {
          map.set(sub.studentId, sub);
        } else {
          const existing = map.get(sub.studentId);
          if (new Date(sub.submittedAt).getTime() > new Date(existing.submittedAt).getTime()) {
            map.set(sub.studentId, sub);
          }
        }
      });
      const uniqueSubs = Array.from(map.values());

      // 3. Build summary
      const summary = uniqueSubs.map(s => {
        const student = students.find(st => st.uid === s.studentId);
        return {
          submissionId: s.id,
          studentId: s.studentId,
          studentName: student ? student.name : 'Học sinh',
          score: s.score,
          incorrectQuestions: s.incorrectQuestions || [],
          submittedAt: s.submittedAt
        };
      });

      // 4. Update exam document
      await updateDoc(doc(db, 'exams', examId), {
        submissionSummary: summary
      });

      // 5. Update local state
      setExams(exams.map(e => e.id === examId ? { ...e, submissionSummary: summary } : e));
      await syncTeacherSummary(appUser.uid);
      alert('Đồng bộ dữ liệu cũ thành công!');
    } catch (error) {
      console.error("Error syncing old data:", error);
      alert('Có lỗi xảy ra khi đồng bộ dữ liệu.');
    } finally {
      setSyncingExamId(null);
    }
  };

  const handleSyncOldDataEssay = async (essayId: string) => {
    setSyncingEssayId(essayId);
    try {
      // 1. Fetch all submissions for this essay
      const qSubmissions = query(collection(db, 'essay_submissions'), where('essayId', '==', essayId));
      const subSnap = await getDocs(qSubmissions);
      const subs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Build summary
      const summary = subs.map(s => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.studentName || 'Học sinh',
        studentClass: s.studentClass || '',
        submittedAt: s.submittedAt,
        status: s.status || 'submitted',
        score: s.score !== undefined ? s.score : null
      }));

      // 3. Update essay document
      await updateDoc(doc(db, 'essays', essayId), {
        submissionSummary: summary
      });

      // 4. Update local state
      setEssays(essays.map(e => e.id === essayId ? { ...e, submissionSummary: summary } : e));
      
      // 5. Update counts state
      setEssaySubmissionsCounts(prev => ({ ...prev, [essayId]: summary.length }));
      
      alert('Đồng bộ dữ liệu tự luận thành công!');
    } catch (error) {
      console.error("Error syncing old essay data:", error);
      alert('Có lỗi xảy ra khi đồng bộ dữ liệu tự luận.');
    } finally {
      setSyncingEssayId(null);
    }
  };

  const handleExtendTime = async () => {
    if (!examToExtend || !newEndTime || !appUser) return;
    try {
      const examRef = doc(db, 'exams', examToExtend.id);
      await updateDoc(examRef, { endTime: newEndTime });
      
      // Update the exam_results_cover immediately with 0 Reads (merge write)
      const examResultsCoverRef = doc(db, 'exam_results_cover', examToExtend.id);
      await setDoc(examResultsCoverRef, { endTime: newEndTime }, { merge: true });
      
      const classesToSync = examToExtend.assignedClasses || [];
      for (const cls of classesToSync) {
         await syncClassSummary(cls);
      }
      
      setExamToExtend(null);
      setNewEndTime('');
      
      // update local
      setExams(exams.map(e => e.id === examToExtend.id ? { ...e, endTime: newEndTime } : e));
      await syncExamsCover(appUser.uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exams/${examToExtend.id}`);
    }
  };

  const handleExtendTimeEssay = async () => {
    if (!essayToExtend || !newEndTime || !appUser) return;
    try {
      const essayRef = doc(db, 'essays', essayToExtend.id);
      await updateDoc(essayRef, { endTime: newEndTime });
      
      // Update the essay_results_cover immediately with 0 Reads (merge write)
      const essayResultsCoverRef = doc(db, 'essay_results_cover', essayToExtend.id);
      await setDoc(essayResultsCoverRef, { endTime: newEndTime }, { merge: true });
      
      const classesToSync = essayToExtend.assignedClasses || [];
      for (const cls of classesToSync) {
         await syncClassSummary(cls);
      }
      
      setEssayToExtend(null);
      setNewEndTime('');
      
      // update local
      setEssays(essays.map(e => e.id === essayToExtend.id ? { ...e, endTime: newEndTime } : e));
      await syncEssaysCover(appUser.uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `essays/${essayToExtend.id}`);
    }
  };

  
  const handleZaloNotifyNewTask = async (item, className) => {
    if (!className) return;
    
    // Check if extension is installed
    if (!document.documentElement.getAttribute('data-zalo-extension')) {
        alert("⚠️ CHƯA CÀI ĐẶT TIỆN ÍCH ZALO\n\nVui lòng tải thư mục /zalo-extension về máy tính, giải nén (nếu có), vào Chrome -> Tiện ích mở rộng -> Bật Chế độ cho nhà phát triển -> Tải tiện ích đã giải nén -> Chọn thư mục zalo-extension.");
        return;
    }

    try {
      let studs = [];
      const classCoverDoc = await getDoc(doc(db, 'class_students_cover', className));
      if (classCoverDoc.exists()) {
        studs = classCoverDoc.data().students || [];
      } else {
        studs = await syncClassStudentsCover(className) || [];
      }

      if (studs.length === 0) {
        alert('Lớp này chưa có học sinh nào.');
        return;
      }

      const campaignData = [];
      for (const s of studs) {
        if (!s.zalo) continue;
        const msg = `Chào em: ${s.name}. Hiện tại đã có bài tập mới: ${item.title}. Em đăng nhập để xem nhé!`;
        campaignData.push({ phone: s.zalo, message: msg });
      }
      
      if(campaignData.length === 0) {
        alert("Lớp này không có học sinh nào nhập số Zalo.");
        return;
      }

      triggerZaloCampaign(campaignData);
    } catch (e) {
      console.error(e);
      alert('Lỗi khi lấy danh sách lớp.');
    }
  };

  const executeNotify = () => {
    if (!notifyModalItem || !selectedNotifyClass) return;

    let message = '';
    if (notifyModalItem.type === 'exam') {
      message = `🚨 BÀI TẬP TRẮC NGHIỆM MỚI 🚨\n\n📌 ${notifyModalItem.title}\n⏱️ Thời gian: ${notifyModalItem.duration} phút\n${notifyModalItem.startTime ? `⏰ Mở: ${new Date(notifyModalItem.startTime).toLocaleString('vi-VN')}\n` : ''}${notifyModalItem.endTime ? `⏳ Hạn chót: ${new Date(notifyModalItem.endTime).toLocaleString('vi-VN')}\n` : ''}\n👉 Các em chú ý đăng nhập vào hệ thống để làm bài đúng hạn nhé!\n🔗 Link: ${window.location.origin}`;
    } else {
      message = `🚨 BÀI TẬP TỰ LUẬN MỚI 🚨\n\n📌 ${notifyModalItem.title}\n${notifyModalItem.startTime ? `⏰ Mở: ${new Date(notifyModalItem.startTime).toLocaleString('vi-VN')}\n` : ''}${notifyModalItem.endTime ? `⏳ Hạn chót: ${new Date(notifyModalItem.endTime).toLocaleString('vi-VN')}\n` : ''}\n👉 Các em chú ý đăng nhập vào hệ thống để làm bài đúng hạn nhé!\n🔗 Link: ${window.location.origin}`;
    }

    navigator.clipboard.writeText(message).catch(err => console.error("Failed to copy message:", err));

    const classInfo = teacherClasses.find(c => c.name === selectedNotifyClass);
    if (classInfo && classInfo.zaloLink) {
      let webLink = classInfo.zaloLink;
      if (webLink.includes('zalo.me/g/')) {
        webLink = webLink.replace('zalo.me/g/', 'chat.zalo.me/?g=');
      }
      window.open(webLink, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://chat.zalo.me/', '_blank', 'noopener,noreferrer');
    }

    setNotifyModalItem(null);
  };

  const handleSyncClassCover = async (className: string) => {
    setSyncingClassCover(className);
    try {
      await syncClassStudentsCover(className);
      alert(`Đã đồng bộ Tờ bìa học sinh lớp ${className} thành công!`);
    } catch (error) {
      console.error(error);
      alert(`Lỗi khi đồng bộ Tờ bìa học sinh lớp ${className}.`);
    } finally {
      setSyncingClassCover(null);
    }
  };

  const handleSyncDashboardCover = async (className: string) => {
    setSyncingDashboardCover(className);
    try {
      await syncClassDashboardCover(className);
      setSyncedDashboardCovers(prev => new Set(prev).add(className));
      alert(`Đã đồng bộ Tờ bìa nội dung lớp ${className} thành công!`);
    } catch (error) {
      console.error(error);
      alert(`Lỗi khi đồng bộ Tờ bìa nội dung lớp ${className}.`);
    } finally {
      setSyncingDashboardCover(null);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser?.uid || !newClass.name || !newClass.block) return;
    setIsCreatingClass(true);
    try {
      const docRef = await addDoc(collection(db, 'classes'), {
        name: newClass.name.trim(),
        block: newClass.block,
        zaloLink: newClass.zaloLink.trim(),
        teacherId: appUser.uid,
        createdAt: new Date().toISOString()
      });
      
      const newClassData = {
        id: docRef.id,
        name: newClass.name.trim(),
        block: newClass.block,
        zaloLink: newClass.zaloLink.trim(),
        teacherId: appUser.uid,
        createdAt: new Date().toISOString()
      };
      
      const updatedList = [...teacherClasses, newClassData];
      updatedList.sort((a: any, b: any) => {
        if (a.block !== b.block) return a.block.localeCompare(b.block);
        return a.name.localeCompare(b.name);
      });
      setTeacherClasses(updatedList);
      
      if (!availableClasses.includes(newClass.name.trim())) {
        const newAvailable = [...availableClasses, newClass.name.trim()].sort();
        setAvailableClasses(newAvailable);
      }
      
      setNewClass({ name: '', block: '10', zaloLink: '' });
      alert('Tạo lớp thành công!');
    } catch (error) {
      console.error(error);
      alert('Lỗi tạo lớp.');
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setIsUpdatingClass(true);
    try {
      await updateDoc(doc(db, 'classes', editingClass.id), {
        name: editClassData.name.trim(),
        block: editClassData.block,
        zaloLink: editClassData.zaloLink.trim()
      });
      
      const updatedList = teacherClasses.map(c => 
        c.id === editingClass.id 
          ? { ...c, name: editClassData.name.trim(), block: editClassData.block, zaloLink: editClassData.zaloLink.trim() } 
          : c
      );
      updatedList.sort((a: any, b: any) => {
        if (a.block !== b.block) return a.block.localeCompare(b.block);
        return a.name.localeCompare(b.name);
      });
      setTeacherClasses(updatedList);
      setEditingClass(null);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi cập nhật lớp');
    } finally {
      setIsUpdatingClass(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    try {
      const classObj = teacherClasses.find(c => c.id === classToDelete);
      await deleteDoc(doc(db, 'classes', classToDelete));
      const newTeacherClasses = teacherClasses.filter(c => c.id !== classToDelete);
      setTeacherClasses(newTeacherClasses);
      
      if (classObj) {
        setAvailableClasses(prev => prev.filter(name => name !== classObj.name));
        if (activeClass === classObj.name) {
           setActiveClass(newTeacherClasses.length > 0 ? newTeacherClasses[0].name : '');
        }
      }

      setClassToDelete(null);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi xóa lớp.');
    }
  };

  const handleCreateKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser?.uid || !newKnowledge.title || !newKnowledge.fileUrl) return;
    setIsCreatingKnowledge(true);
    try {
      const docRef = await addDoc(collection(db, 'knowledges'), {
        title: newKnowledge.title,
        block: newKnowledge.block,
        className: newKnowledge.className ? newKnowledge.className.trim() : '',
        fileUrl: newKnowledge.fileUrl,
        teacherId: appUser.uid,
        createdAt: new Date().toISOString()
      });
      await saveKnowledgeMetadata(docRef.id, {
        title: newKnowledge.title,
        block: newKnowledge.block,
        className: newKnowledge.className ? newKnowledge.className.trim() : '',
        teacherId: appUser.uid,
        createdAt: new Date().toISOString()
      });
      setKnowledges([{ id: docRef.id, ...newKnowledge, teacherId: appUser.uid, createdAt: new Date().toISOString() }, ...knowledges]);
      
      // Update class summaries
      const targetClass = newKnowledge.className ? newKnowledge.className.trim() : '';
      if (targetClass) {
        await syncClassSummary(targetClass);
      } else if (newKnowledge.block) {
        // Sync all available classes in this block
        const blockClasses = teacherClasses.filter(c => c.block === newKnowledge.block).map(c => c.name);
        for (const cls of blockClasses) {
          await syncClassSummary(cls);
        }
      }
      
      await syncTeacherSummary(appUser.uid);
      await syncKnowledgesCover(appUser.uid);
      
      setNewKnowledge({ title: '', block: '10', className: '', fileUrl: '' });
      alert('Tạo kiến thức thành công!');
    } catch (error) {
      console.error(error);
      alert('Lỗi khi tạo kiến thức.');
    } finally {
      setIsCreatingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async () => {
    if (!knowledgeToDelete || !appUser) return;
    try {
      const knowledge = knowledges.find(k => k.id === knowledgeToDelete);
      
      await deleteDoc(doc(db, 'knowledges', knowledgeToDelete));
      await deleteKnowledgeMetadata(knowledgeToDelete);
      setKnowledges(knowledges.filter(k => k.id !== knowledgeToDelete));
      setKnowledgeToDelete(null);
      
      if (knowledge?.className) {
        await syncClassSummary(knowledge.className);
      } else if (knowledge?.block) {
        const blockClasses = teacherClasses.filter(c => c.block === knowledge.block).map(c => c.name);
        for (const cls of blockClasses) {
          await syncClassSummary(cls);
        }
      }
      
      await syncTeacherSummary(appUser.uid);
      await syncKnowledgesCover(appUser.uid);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi xóa kiến thức.');
    }
  };

  const handleUpdateKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKnowledge || !appUser?.uid) return;
    setIsUpdatingKnowledge(true);
    
    try {
      const oldKnowledge = knowledges.find(k => k.id === editingKnowledge.id);
      
      await updateDoc(doc(db, 'knowledges', editingKnowledge.id), {
        title: editingKnowledge.title,
        block: editingKnowledge.block,
        className: editingKnowledge.className ? editingKnowledge.className.trim() : '',
        fileUrl: editingKnowledge.fileUrl,
      });
      await saveKnowledgeMetadata(editingKnowledge.id, {
        title: editingKnowledge.title,
        block: editingKnowledge.block,
        className: editingKnowledge.className ? editingKnowledge.className.trim() : '',
        teacherId: appUser.uid,
      });
      
      setKnowledges(knowledges.map(k => k.id === editingKnowledge.id ? { ...k, ...editingKnowledge, className: editingKnowledge.className ? editingKnowledge.className.trim() : '' } : k));
      setEditingKnowledge(null);
      
      // Update class summaries for both old and new classes to remove/add knowledge correctly
      const classTitlesToSync = new Set<string>();
      if (editingKnowledge.className) classTitlesToSync.add(editingKnowledge.className.trim());
      else {
         const blockClasses = teacherClasses.filter(c => c.block === editingKnowledge.block).map(c => c.name);
         blockClasses.forEach(cls => classTitlesToSync.add(cls));
      }

      if (oldKnowledge?.className) classTitlesToSync.add(oldKnowledge.className.trim());
      else if (oldKnowledge?.block) {
         const blockClasses = teacherClasses.filter(c => c.block === oldKnowledge.block).map(c => c.name);
         blockClasses.forEach(cls => classTitlesToSync.add(cls));
      }

      for (const cls of classTitlesToSync) {
        if (cls) await syncClassSummary(cls);
      }
      
      await syncTeacherSummary(appUser.uid);
      await syncKnowledgesCover(appUser.uid);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi cập nhật tài liệu.');
    } finally {
      setIsUpdatingKnowledge(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Sidebar / Topbar */}
      <aside className="w-full md:w-72 bg-[#0A1128] border-b md:border-b-0 md:border-r border-[#1a2238] flex md:flex-col fixed top-0 left-0 z-50 md:inset-y-0 h-auto md:h-full items-center md:items-stretch">
        <div className="flex-1 flex md:flex-col overflow-x-auto overflow-y-hidden md:overflow-visible p-3 md:p-6 md:pb-2 scrollbar-hide items-center md:items-stretch">
          <div className="flex items-center space-x-3 md:mb-8 shrink-0 mr-6 md:mr-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-[1rem] bg-indigo-600 flex flex-col items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.5} />
            </div>
            <span className="text-xl md:text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>TỔNG QUAN</span>
          </div>

          <h3 className="hidden md:block px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            MENU GIÁO VIÊN
          </h3>
          
          <nav className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab('exams')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'exams'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <FileText className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'exams' ? 2.5 : 1.5} />
              Quản lí Đề thi
            </button>
            <button
              onClick={() => setActiveTab('essays')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'essays'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <FileText className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'essays' ? 2.5 : 1.5} />
              Bài tập tự luận
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'knowledge'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <BookOpen className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'knowledge' ? 2.5 : 1.5} />
              Hệ thống kiến thức
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'students'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <Users className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'students' ? 2.5 : 1.5} />
              Học sinh
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'classes'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <FileText className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'classes' ? 2.5 : 1.5} />
              Quản lý Lớp
            </button>
            <button
              onClick={() => setActiveTab('facebook')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'facebook'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <MessageCircle className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'facebook' ? 2.5 : 1.5} />
              Liên hệ
            </button>
          </nav>
        </div>

        <div className="shrink-0 p-3 md:mt-auto md:p-4 md:m-4 md:bg-[#111827] md:border md:border-[#1f2937] md:rounded-3xl flex md:block items-center">
          <div className="hidden md:flex items-center space-x-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
              {appUser?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{appUser?.name}</p>
              <p className="text-xs text-slate-400 truncate">Giáo viên</p>
            </div>
          </div>
          <button onClick={logout} className="md:w-full flex items-center px-3 md:px-4 py-2 md:py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-xl md:rounded-2xl transition-colors font-semibold" title="Đăng xuất">
            <LogOut className="w-5 h-5 md:w-4 md:h-4 md:mr-3" />
            <span className="hidden md:inline">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 mt-[72px] md:mt-0 md:ml-72">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8 pb-4 md:pb-6 border-b border-slate-200">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">
              {activeTab === 'exams' && 'Quản lí Đề thi'}
              {activeTab === 'essays' && 'Bài tập tự luận'}
              {activeTab === 'knowledge' && 'Hệ thống kiến thức'}
              {activeTab === 'students' && 'Quản lý Học sinh & Lớp học'}
              {activeTab === 'classes' && 'Quản lý Lớp học'}
              {activeTab === 'facebook' && 'Thông tin Liên hệ (Facebook/Zalo)'}
            </h2>
            <div className="flex items-center space-x-4">
              {activeTab === 'exams' && (
                <Link to="/teacher/exam/new" className="bg-indigo-600 text-white px-5 py-2.5 rounded-full font-bold flex items-center hover:bg-indigo-700 transition-colors shadow-sm text-sm">
                  <Plus className="w-5 h-5 mr-1.5" strokeWidth={2.5} /> Tạo đề thi mới
                </Link>
              )}
              {activeTab === 'essays' && (
                <Link to="/teacher/essay/new" className="bg-indigo-600 text-white px-5 py-2.5 rounded-full font-bold flex items-center hover:bg-indigo-700 transition-colors shadow-sm text-sm">
                  <Plus className="w-5 h-5 mr-1.5" strokeWidth={2.5} /> Tạo bài tập tự luận
                </Link>
              )}
              <button onClick={() => fetchData(true)} disabled={isRefreshing} className="flex items-center px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start">
              <AlertCircle className="w-5 h-5 text-rose-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-rose-700 font-medium">{error}</div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {exams.length === 0 ? (
                <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-2">
                  <div className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-medium">Chưa có đề thi nào.</p>
                    <p className="text-sm mt-1">Hãy tạo đề thi đầu tiên của bạn!</p>
                  </div>
                </div>
              ) : (
                (() => {
                  const groupedExams = exams.reduce((acc, exam) => {
                    let block = 'Khác';
                    if (exam.assignedClasses && exam.assignedClasses.length > 0) {
                       const classObj = teacherClasses.find(c => exam.assignedClasses.includes(c.name));
                       if (classObj && classObj.block) {
                         block = classObj.block;
                       }
                    }
                    if (block === 'Khác') {
                      const match = (exam.title || '').match(/(lớp|khối|toán|toan)\s*(\d{1,2})/i);
                      if (match) {
                        block = match[2];
                      }
                    }
                    if (!acc[block]) acc[block] = [];
                    acc[block].push(exam);
                    return acc;
                  }, {} as Record<string, any[]>);

                  const sortedBlocks = Object.keys(groupedExams).sort((a, b) => {
                    if (a === 'Khác') return 1;
                    if (b === 'Khác') return -1;
                    return parseInt(a) - parseInt(b);
                  });

                  return (
                    <div className="space-y-4">
                      {sortedBlocks.map(block => {
                        const sortedExams = [...groupedExams[block]].sort((a, b) => {
                          const getNum = (title: string) => {
                            const match = (title || '').match(/^\s*(\d+)/);
                            return match ? parseInt(match[1], 10) : Infinity;
                          };
                          const numA = getNum(a.title);
                          const numB = getNum(b.title);
                          if (numA !== numB) return numA - numB;
                          return (a.title || '').localeCompare(b.title || '');
                        });

                        const isBlockOpen = expandedExamBlock === block;
                        return (
                          <div key={block} className="bg-white shadow-sm sm:rounded-[2rem] border border-slate-200/60 p-2 overflow-hidden transition-all">
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = isBlockOpen ? null : block;
                                setExpandedExamBlock(nextVal);
                                dashboardCache.expandedExamBlock = nextVal;
                              }}
                              className="w-full px-6 py-4 bg-indigo-50/50 hover:bg-indigo-100/50 border-b border-indigo-100 rounded-[1.5rem] cursor-pointer outline-none flex justify-between items-center transition-colors text-left"
                            >
                              <h3 className="text-lg font-bold text-indigo-900 flex items-center">
                                {block === 'Khác' ? 'Khối khác / Không xác định' : `Khối ${block}`}
                                <span className="ml-3 bg-indigo-100 text-indigo-700 py-0.5 px-2.5 rounded-full text-sm font-semibold">
                                  {sortedExams.length} bài
                                </span>
                              </h3>
                              <svg className={`w-5 h-5 text-indigo-400 transform transition-transform duration-200 ${isBlockOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {isBlockOpen && (
                              <div className="overflow-hidden">
                                <ul className="divide-y divide-gray-100 mt-2">
                                {sortedExams.map((exam, index) => (
                              <li key={exam.id} className="hover:bg-indigo-50/50 transition-colors duration-150">
                                <div className="px-6 py-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                                  <div className="flex items-start">
                                    <span className="text-xl font-black text-indigo-200 w-8 flex-shrink-0 mt-0.5">{index + 1}.</span>
                                    <div>
                                      <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{exam.title}</h3>
                                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                        <span className="flex items-center bg-gray-100 px-2.5 py-1 rounded-md font-medium">
                                          <Clock className="w-4 h-4 mr-1.5 text-gray-500" /> {exam.duration} phút
                                        </span>
                                        <span className={`px-2.5 py-1 rounded-md font-medium ${exam.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                          {exam.status === 'published' ? 'Đã giao' : 'Bản nháp'}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm text-gray-600 flex items-center">
                                        <span className="font-medium mr-1">Lớp được giao:</span> {exam.assignedClasses?.join(', ') || 'Chưa giao'}
                                      </p>
                                      {(exam.startTime || exam.endTime) && (
                                        <p className="mt-1 text-sm text-gray-500">
                                          Thời gian mở: {exam.startTime ? new Date(exam.startTime).toLocaleString('vi-VN') : 'Không giới hạn'} - {exam.endTime ? new Date(exam.endTime).toLocaleString('vi-VN') : 'Không giới hạn'}
                                        </p>
                                      )}
                                      <div className="mt-1 flex items-center space-x-3">
                                        <p className="text-sm font-semibold text-indigo-600">
                                          Đã nộp: {exam.submissionSummary ? (() => {
                                            const uniqueStudents = new Set(exam.submissionSummary.map((s: any) => s.studentId || s.studentName || s.submissionId));
                                            return uniqueStudents.size;
                                          })() : 0} học sinh
                                        </p>
                                        {exam.submissionSummary === undefined && (
                                          <button
                                            onClick={() => handleSyncOldData(exam.id)}
                                            disabled={syncingExamId === exam.id}
                                            className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors flex items-center"
                                          >
                                            {syncingExamId === exam.id ? (
                                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                            ) : (
                                              <RefreshCw className="w-3 h-3 mr-1" />
                                            )}
                                            Đồng bộ dữ liệu cũ
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0 justify-start sm:justify-end">
                                    {exam.status === 'published' && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setNotifyModalItem({
                                              id: exam.id,
                                              type: 'exam',
                                              title: exam.title || 'Bài tập',
                                              duration: exam.duration,
                                              startTime: exam.startTime,
                                              endTime: exam.endTime,
                                              assignedClasses: exam.assignedClasses || []
                                            });
                                            setSelectedNotifyClass('');
                                          }}
                                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                          title="Báo bài cho lớp"
                                        >
                                          <MessageCircle className="w-4 h-4 mr-1.5" /> Báo bài
                                        </button>
                                        <button
                                          onClick={() => {
                                            setExamToExtend(exam);
                                            setNewEndTime(exam.endTime || '');
                                          }}
                                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium text-sm transition-colors"
                                        >
                                          Gia hạn
                                        </button>
                                        <Link to={`/teacher/exam/${exam.id}/results`} state={{ exam }} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors">
                                          Xem kết quả
                                        </Link>
                                        <button
                                          onClick={() => setRankingExam(exam)}
                                          className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                          title="Xếp hạng 5 học sinh điểm cao nhất"
                                        >
                                          <Trophy className="w-4 h-4 mr-1.5" /> Xếp hạng
                                        </button>
                                      </>
                                    )}
                                    <Link to={`/teacher/exam/${exam.id}/edit`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chỉnh sửa">
                                      <Edit className="w-5 h-5" />
                                    </Link>
                                    <button 
                                      onClick={() => setExamToDelete(exam.id)}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                            </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {activeTab === 'essays' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {essays.length === 0 ? (
                <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-6 md:p-8">
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto text-indigo-200 mb-4" />
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Chưa có bài tập tự luận nào</h3>
                    <p className="text-slate-500 max-w-lg mx-auto mb-8">
                      Bấm vào nút "Tạo bài tập tự luận" để bắt đầu giao bài cho học sinh.
                    </p>
                  </div>
                </div>
              ) : (
                (() => {
                  const groupedEssays = essays.reduce((acc, essay) => {
                    let block = 'Khác';
                    if (essay.assignedClasses && essay.assignedClasses.length > 0) {
                       const classObj = teacherClasses.find(c => essay.assignedClasses.includes(c.name));
                       if (classObj && classObj.block) {
                         block = classObj.block;
                       }
                    }
                    if (block === 'Khác') {
                      const match = (essay.title || '').match(/(lớp|khối|toán|toan)\s*(\d{1,2})/i);
                      if (match) {
                        block = match[2];
                      }
                    }
                    if (!acc[block]) acc[block] = [];
                    acc[block].push(essay);
                    return acc;
                  }, {} as Record<string, any[]>);

                  const sortedBlocks = Object.keys(groupedEssays).sort((a, b) => {
                    if (a === 'Khác') return 1;
                    if (b === 'Khác') return -1;
                    return parseInt(a) - parseInt(b);
                  });

                  return (
                    <div className="space-y-4">
                      {sortedBlocks.map(block => {
                        const sortedEssays = [...groupedEssays[block]].sort((a, b) => {
                          const getNum = (title: string) => {
                            const match = (title || '').match(/^\s*(\d+)/);
                            return match ? parseInt(match[1], 10) : Infinity;
                          };
                          const numA = getNum(a.title);
                          const numB = getNum(b.title);
                          if (numA !== numB) return numA - numB;
                          return (a.title || '').localeCompare(b.title || '');
                        });

                        const isBlockOpen = expandedEssayBlock === block;
                        return (
                          <div key={block} className="bg-white shadow-sm sm:rounded-[2rem] border border-slate-200/60 p-2 overflow-hidden transition-all">
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = isBlockOpen ? null : block;
                                setExpandedEssayBlock(nextVal);
                                dashboardCache.expandedEssayBlock = nextVal;
                              }}
                              className="w-full px-6 py-4 bg-indigo-50/50 hover:bg-indigo-100/50 border-b border-indigo-100 rounded-[1.5rem] cursor-pointer outline-none flex justify-between items-center transition-colors text-left"
                            >
                              <h3 className="text-lg font-bold text-indigo-900 flex items-center">
                                {block === 'Khác' ? 'Khối khác / Không xác định' : `Khối ${block}`}
                                <span className="ml-3 bg-indigo-100 text-indigo-700 py-0.5 px-2.5 rounded-full text-sm font-semibold">
                                  {sortedEssays.length} bài
                                </span>
                              </h3>
                              <svg className={`w-5 h-5 text-indigo-400 transform transition-transform duration-200 ${isBlockOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {isBlockOpen && (
                              <div className="overflow-hidden">
                                <ul className="divide-y divide-gray-100 mt-2">
                                {sortedEssays.map((essay, index) => (
                              <li key={essay.id} className="hover:bg-indigo-50/50 transition-colors duration-150">
                                <div className="px-6 py-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                                  <div className="flex items-start">
                                    <span className="text-xl font-black text-indigo-200 w-8 flex-shrink-0 mt-0.5">{index + 1}.</span>
                                    <div>
                                      <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{essay.title}</h3>
                                      <p className="mt-2 text-sm text-gray-600 flex items-center">
                                        <span className="font-medium mr-1">Lớp được giao:</span> {essay.assignedClasses?.join(', ') || 'Chưa giao'}
                                      </p>
                                      {(essay.startTime || essay.endTime) && (
                                        <p className="mt-1 text-sm text-gray-500">
                                          Thời gian mở: {essay.startTime ? new Date(essay.startTime).toLocaleString('vi-VN') : 'Không giới hạn'} - {essay.endTime ? new Date(essay.endTime).toLocaleString('vi-VN') : 'Không giới hạn'}
                                        </p>
                                      )}
                                      <div className="mt-1 flex items-center space-x-3">
                                        <p className="text-sm font-semibold text-indigo-600">
                                          Đã nộp: {essaySubmissionsCounts[essay.id] || 0} học sinh
                                        </p>
                                        {essay.submissionSummary === undefined && (
                                          <button
                                            onClick={() => handleSyncOldDataEssay(essay.id)}
                                            disabled={syncingEssayId === essay.id}
                                            className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors flex items-center animate-pulse"
                                            title="Đồng bộ dữ liệu học sinh nộp bài để tối ưu quota (Tờ bìa)"
                                          >
                                            {syncingEssayId === essay.id ? (
                                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                            ) : (
                                              <RefreshCw className="w-3 h-3 mr-1" />
                                            )}
                                            Đồng bộ dữ liệu cũ (Tờ bìa)
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0 justify-start sm:justify-end">
                                    <button
                                      onClick={() => {
                                        if (essay.assignedClasses && essay.assignedClasses.length > 0) {
                                            const cls = prompt("Báo bài mới (Zalo cá nhân)\nNhập tên lớp (Ví dụ: " + essay.assignedClasses[0] + "):", essay.assignedClasses[0]);
                                            if (cls) {
                                                handleZaloNotifyNewTask({title: essay.title || 'Bài tập tự luận'}, cls);
                                            }
                                        } else {
                                            alert("Bài này chưa được giao cho lớp nào.");
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                      title="Báo bài mới (Zalo cá nhân)"
                                    >
                                      <Send className="w-4 h-4 mr-1.5" /> Báo (Zalo)
                                    </button>
                                    <button
                                      onClick={() => {
                                        setNotifyModalItem({
                                          id: essay.id,
                                          type: 'essay',
                                          title: essay.title || 'Bài tập tự luận',
                                          startTime: essay.startTime,
                                          endTime: essay.endTime,
                                          assignedClasses: essay.assignedClasses || []
                                        });
                                        setSelectedNotifyClass('');
                                      }}
                                      className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                      title="Báo bài cho lớp"
                                    >
                                      <MessageCircle className="w-4 h-4 mr-1.5" /> Báo bài
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEssayToExtend(essay);
                                        setNewEndTime(essay.endTime || '');
                                      }}
                                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium text-sm transition-colors"
                                    >
                                      Gia hạn
                                    </button>
                                    <Link to={`/teacher/essay/${essay.id}/results`} state={{ essay }} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors">
                                      Xem kết quả
                                    </Link>
                                    <button
                                      onClick={() => setRankingExam({ ...essay, isEssay: true })}
                                      className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                      title="Xếp hạng 5 học sinh điểm cao nhất"
                                    >
                                      <Trophy className="w-4 h-4 mr-1.5" /> Xếp hạng
                                    </button>
                                    <Link to={`/teacher/essay/${essay.id}/edit`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Chỉnh sửa">
                                      <Edit2 className="w-5 h-5" />
                                    </Link>
                                    <button
                                      onClick={() => setEssayToDelete(essay.id)}
                                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                            </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {activeTab === 'knowledge' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Thêm bài mới</h3>
                <form onSubmit={handleCreateKnowledge} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tên bài học</label>
                    <input type="text" required value={newKnowledge.title} onChange={e => setNewKnowledge({...newKnowledge, title: e.target.value})} placeholder="Vd: Bài 1: Hàm số lượng giác" className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Khối</label>
                    <select value={newKnowledge.block} onChange={e => setNewKnowledge({...newKnowledge, block: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                      <option value="10">Khối 10</option>
                      <option value="11">Khối 11</option>
                      <option value="12">Khối 12</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Lớp (Tùy chọn)</label>
                    <select value={newKnowledge.className} onChange={e => setNewKnowledge({...newKnowledge, className: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                      <option value="">-- Dành cho tất cả các lớp trong khối --</option>
                      {teacherClasses.filter(c => c.block === newKnowledge.block).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Link tài liệu (Hình ảnh / PDF / Drive)</label>
                    <input type="url" required value={newKnowledge.fileUrl} onChange={e => setNewKnowledge({...newKnowledge, fileUrl: e.target.value})} placeholder="https://..." className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <button type="submit" disabled={isCreatingKnowledge} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5">
                    {isCreatingKnowledge ? 'Đang thêm...' : 'Thêm bài học'}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900">Danh sách bài học</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tên bài học</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Khối</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {knowledges.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                            Chưa có bài học nào được thêm.
                          </td>
                        </tr>
                      ) : (
                        [...new Set(knowledges.map(k => k.block || '10'))].sort((a,b) => parseInt(a as string ||'0') - parseInt(b as string ||'0')).map((block: any) => (
                          <React.Fragment key={block}>
                            <tr className="bg-gray-100/80 border-y border-gray-200">
                              <td colSpan={4} className="px-6 py-3 text-left text-sm font-black text-indigo-800 uppercase tracking-wider bg-indigo-50/50">
                                Khối {block}
                              </td>
                            </tr>
                            {knowledges.filter(k => (k.block || '10') === block).map((k) => (
                              <tr key={k.id} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                  <a href={k.fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline">
                                    {k.title}
                                  </a>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  Khối {k.block || '10'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {k.className || <span className="text-gray-400 italic">Tất cả</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                                  <button
                                    onClick={() => setEditingKnowledge(k)}
                                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    onClick={() => setKnowledgeToDelete(k.id)}
                                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                                  >
                                    Xóa
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className={showCreateStudentForm ? "grid grid-cols-1 md:grid-cols-3 gap-8" : "space-y-6"}>
            {showCreateStudentForm && (
              <div className="md:col-span-1">
                <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100 relative">
                  <button
                    onClick={() => setShowCreateStudentForm(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Ẩn form"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h3 className="text-xl font-bold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Tạo tài khoản học sinh</h3>
                  <form onSubmit={handleCreateStudent} className="space-y-5">
                    {studentError && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-red-700 font-medium">{studentError}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Họ và tên</label>
                      <input type="text" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Lớp</label>
                      <input type="text" required value={newStudent.className} onChange={e => setNewStudent({...newStudent, className: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                      <input type="email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu</label>
                      <input type="password" required minLength={6} value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                    </div>
                    <button type="submit" disabled={creatingStudent} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5">
                      {creatingStudent ? 'Đang tạo...' : 'Tạo tài khoản'}
                    </button>
                  </form>

                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">Hoặc nhập từ file Excel</h4>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                      File Excel cần có các cột: <strong>FullName</strong>, <strong>Class</strong>, <strong>Email</strong>, <strong>Password</strong>, <strong>Facebook</strong> (có thể thêm cột <strong>Role</strong> là "student").
                    </p>
                    <label className="w-full flex justify-center items-center py-3 px-4 border-2 border-dashed border-indigo-300 rounded-xl shadow-sm text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors">
                      {isImporting ? <span className="animate-pulse">Đang nhập...</span> : <><Upload className="w-5 h-5 mr-2" /> Chọn file Excel</>}
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} disabled={isImporting} />
                    </label>
                  </div>
                </div>
              </div>
            )}
            <div className={showCreateStudentForm ? "md:col-span-2" : "w-full"}>
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      Danh sách học sinh
                      {activeClass && (
                        <div className="ml-4 flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-sm">
                            Sĩ số: {students.filter(s => s.status === 'active').length}
                          </span>
                          {students.filter(s => s.status === 'pending').length > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm animate-pulse">
                              Chờ duyệt: {students.filter(s => s.status === 'pending').length}
                            </span>
                          )}
                        </div>
                      )}
                    </h3>
                    <select
                      value={activeClass}
                      onChange={(e) => setActiveClass(e.target.value)}
                      className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="">-- Chọn Cấp Lớp --</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          Lớp {cls}
                        </option>
                      ))}
                    </select>
                    {activeClass && (
                      <button 
                        onClick={handleManualSyncClass}
                        disabled={isSyncingClass}
                        className="text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-md flex items-center font-semibold transition-colors disabled:opacity-50"
                        title="Cập nhật Tờ bìa học sinh cho lớp này"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${isSyncingClass ? 'animate-spin' : ''}`} />
                        Cập nhật Tờ bìa lớp
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setShowCreateStudentForm(!showCreateStudentForm)}
                      className={`text-sm px-3.5 py-2 rounded-lg flex items-center font-bold transition-all shadow-sm ${
                        showCreateStudentForm
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {showCreateStudentForm ? (
                        <>
                          <X className="w-4 h-4 mr-1.5" /> Ẩn tạo tài khoản
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1.5" /> Tạo tài khoản / Excel
                        </>
                      )}
                    </button>
                    {isFetchingStudents && <span className="text-sm text-gray-500">Đang tải...</span>}
                    {students.length > 0 && (
                      <button 
                        onClick={() => setIsDeletingAll(true)}
                        className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3.5 py-2 rounded-lg flex items-center font-bold transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" /> Xóa toàn bộ
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-[22%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Họ tên</th>
                        <th className="w-[8%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp</th>
                        <th className="w-[24%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="w-[12%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mật khẩu</th>
                        <th className="w-[24%] px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Tiến độ làm bài</th>
                        <th className="w-[10%] px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {!activeClass ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            Vui lòng chọn một lớp học ở góc trên để xem danh sách học sinh.
                          </td>
                        </tr>
                      ) : students.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            Lớp này hiện chưa có học sinh nào.
                          </td>
                        </tr>
                      ) : (
                        students.map((student) => {
                          const now = new Date();
                        
                        const assignedExamsList = exams.filter(exam => 
                          exam.status === 'published' && 
                          exam.assignedClasses && 
                          exam.assignedClasses.includes(student.className)
                        );
                        
                        const totalAssignedExams = assignedExamsList.length;
                        
                        const openedExams = assignedExamsList.filter(exam => 
                          (!exam.startTime || new Date(exam.startTime) <= now)
                        ).length;

                        // Calculate completed exams using submissionSummary
                        const completedExams = assignedExamsList.filter(exam => {
                          if (!exam.submissionSummary) return false;
                          return exam.submissionSummary.some((s: any) => s.studentId === (student.uid || student.id));
                        }).length;

                        // Calculate completed essays
                        const assignedEssaysList = essays.filter(essay => 
                          essay.status === 'published' && 
                          essay.assignedClasses && 
                          essay.assignedClasses.includes(student.className)
                        );
                        
                        const totalAssignedEssays = assignedEssaysList.length;
                        
                        const openedEssays = assignedEssaysList.filter(essay => 
                          (!essay.startTime || new Date(essay.startTime) <= now)
                        ).length;

                        const completedEssays = assignedEssaysList.filter(essay => {
                          if (!essay.submissionSummary) return false;
                          return essay.submissionSummary.some((s: any) => s.studentId === (student.uid || student.id));
                        }).length;
                        
                        return (
                        <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${student.status === 'pending' ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-3 py-3 text-sm font-semibold text-gray-900" title={student.name}>
                            <div 
                              className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer inline-block" 
                              onClick={() => setViewingStudentDetails(student)}
                            >
                              {student.name}
                            </div>
                            {student.status === 'pending' && (
                              <span className="mt-1 ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                CHỜ PHÊ DUYỆT
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {student.className}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 truncate" title={student.email}>{student.email}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                            <span className="font-mono bg-gray-50 rounded px-1.5 py-1">{student.plainPassword || student.password || '***'}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-medium">
                            {student.status === 'pending' ? (
                               <span className="text-xs text-amber-600 font-medium">Chưa cấp quyền</span>
                            ) : (
                                <div 
                                  className="flex flex-col space-y-1.5 cursor-pointer hover:bg-indigo-50/40 p-2 rounded-xl transition-all border border-transparent hover:border-indigo-100/60"
                                  onClick={() => setViewingStudentExams(student)}
                                  title="Xem chi tiết bài làm của học sinh này"
                                >
                                  <div className="flex items-center justify-between text-[11px] w-full px-1.5">
                                    <span className="text-slate-500 font-bold">Trắc nghiệm:</span>
                                    <span className="font-extrabold text-indigo-600">
                                      {completedExams}
                                      <span className="text-slate-400 font-semibold"> / {openedExams} / {totalAssignedExams}</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] w-full px-1.5">
                                    <span className="text-slate-500 font-bold">Tự luận:</span>
                                    <span className="font-extrabold text-amber-600">
                                      {completedEssays}
                                      <span className="text-slate-400 font-semibold"> / {openedEssays} / {totalAssignedEssays}</span>
                                    </span>
                                  </div>
                                </div>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end items-center space-x-2">
                              {student.status === 'pending' && (
                                <button 
                                  onClick={() => handleAcceptStudent(student.id)}
                                  disabled={acceptingStudentId === student.id}
                                  className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                                  title="Duyệt"
                                >
                                  {acceptingStudentId === student.id ? 'Đang duyệt...' : 'Duyệt'}
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  setEditingStudent(student);
                                  setEditStudentData({ 
                                    name: student.name, 
                                    className: student.className || '', 
                                    email: student.email || '', 
                                    password: student.plainPassword || student.password || '',
                                    dob: student.dob || '',
                                    schoolInfo: student.schoolInfo || '',
                                    address: student.address || '',
                                    zalo: student.zalo || '',
                                    facebook: student.facebook || '',
                                    parentName: student.parentName || '',
                                    parentRelation: student.parentRelation || '',
                                    parentPhone: student.parentPhone || ''
                                  });
                                  setUpdateStudentError('');
                                }}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setStudentToTransfer(student);
                                  setTargetTransferClass('');
                                  setTransferStudentError('');
                                }}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Chuyển lớp"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setStudentToDelete(student.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'facebook' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Danh sách liên hệ Học sinh</h3>
                <p className="text-sm text-gray-500 mt-1">Quản lý link Facebook và số Zalo để gửi thông báo cho học sinh</p>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={activeClass}
                  onChange={(e) => setActiveClass(e.target.value)}
                  className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="">-- Chọn Cấp Lớp --</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Lớp {cls}
                    </option>
                  ))}
                </select>
                {isFetchingStudents && <span className="text-sm text-gray-500">Đang tải...</span>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Họ tên</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Facebook</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Zalo</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {!activeClass ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Vui lòng chọn một lớp học ở góc trên để xem danh sách liên hệ.
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Lớp này hiện chưa có học sinh nào.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const now = new Date();
                    const assignedExamsList = exams.filter(exam => 
                      exam.status === 'published' && 
                      exam.assignedClasses && 
                      exam.assignedClasses.includes(student.className)
                    );
                    const incompleteExams = assignedExamsList.filter(exam => {
                      const isOpened = (!exam.startTime || new Date(exam.startTime) <= now);
                      if (!isOpened) return false;
                      if (!exam.submissionSummary) return true;
                      return !exam.submissionSummary.some((s: any) => s.studentId === (student.uid || student.id));
                    });

                    const assignedEssaysList = essays.filter(essay => 
                      essay.status === 'published' && 
                      essay.assignedClasses && 
                      essay.assignedClasses.includes(student.className)
                    );
                    const incompleteEssays = assignedEssaysList.filter(essay => {
                      const isOpened = (!essay.startTime || new Date(essay.startTime) <= now);
                      if (!isOpened) return false;
                      if (!essay.submissionSummary) return true;
                      return !essay.submissionSummary.some((s: any) => s.studentId === (student.uid || student.id));
                    });

                    const handleContactClick = (e: React.MouseEvent) => {
                      if (incompleteExams.length > 0 || incompleteEssays.length > 0) {
                        let text = '';
                        if (incompleteExams.length > 0) {
                          text += `📝 TRẮC NGHIỆM:\n` + incompleteExams.map((ex, idx) => `  📌 ${idx + 1}. ${ex.title || 'Bài tập'}`).join('\n') + `\n`;
                        }
                        if (incompleteEssays.length > 0) {
                          if (incompleteExams.length > 0) text += `\n`;
                          text += `✍️ TỰ LUẬN:\n` + incompleteEssays.map((es, idx) => `  📌 ${idx + 1}. ${es.title || 'Bài tập tự luận'}`).join('\n') + `\n`;
                        }
                        const message = `🚨 NHẮC NHỞ LÀM BÀI TẬP 🚨\n\nChào ${student.name}, hệ thống ghi nhận em còn các bài tập sau chưa hoàn thành:\n\n${text}\n👉 Em vui lòng đăng nhập vào hệ thống để kiểm tra và làm bài nhé!\n🔗 Link: ${window.location.origin}`;
                        
                        navigator.clipboard.writeText(message).catch(err => {
                          console.error("Failed to copy message:", err);
                        });
                      } else {
                        const message = `Chào ${student.name}, em đã hoàn thành tất cả bài tập trắc nghiệm và tự luận được giao. Chúc em học tập tốt!`;
                        navigator.clipboard.writeText(message).catch(err => console.error(err));
                      }
                    };

                    return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                         <div 
                           className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer inline-block" 
                           onClick={() => setViewingStudentDetails(student)}
                         >
                           {student.name}
                         </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {student.className}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.facebook ? (
                          <a 
                            href={student.facebook} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={handleContactClick}
                            className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                            title="Mở Facebook và Copy tin nhắn nhắc nhở"
                          >
                            <MessageCircle className="w-4 h-4 mr-1.5" /> Nhắn tin
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">Chưa cập nhật</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.zalo ? (
                          <a 
                            href={`https://chat.zalo.me/?phone=${student.zalo}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={handleContactClick}
                            className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                            title="Mở Zalo và Copy tin nhắn nhắc nhở"
                          >
                            <MessageCircle className="w-4 h-4 mr-1.5" />
                            {student.zalo}
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">Chưa cập nhật</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingFbStudent(student);
                            setEditFbData({ facebook: student.facebook || '', zalo: student.zalo || '' });
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Cập nhật Liên hệ"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Thêm lớp mới</h3>
                <form onSubmit={handleCreateClass} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Khối</label>
                    <select value={newClass.block} onChange={e => setNewClass({...newClass, block: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                      <option value="10">Khối 10</option>
                      <option value="11">Khối 11</option>
                      <option value="12">Khối 12</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tên lớp</label>
                    <input type="text" required value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} placeholder="Vd: 10A1" className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Link Zalo nhóm (không bắt buộc)</label>
                    <input type="url" value={newClass.zaloLink} onChange={e => setNewClass({...newClass, zaloLink: e.target.value})} placeholder="https://zalo.me/g/..." className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <button type="submit" disabled={isCreatingClass} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5">
                    {isCreatingClass ? 'Đang thêm...' : 'Tạo lớp'}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                    Danh sách các lớp đã tạo
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {teacherClasses.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-1">Chưa có lớp nào</p>
                      <p className="text-sm">Hãy tạo lớp học đầu tiên của bạn ở form bên cạnh.</p>
                    </div>
                  ) : (
                    teacherClasses.map((cls) => (
                      <div key={cls.id} className="p-6 hover:bg-gray-50 transition-colors duration-150 flex justify-between items-start group">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900 mb-1">{cls.name}</h4>
                          <div className="flex flex-col space-y-2 mt-2">
                            <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Khối {cls.block}
                            </span>
                            {cls.zaloLink && (
                              <a href={cls.zaloLink.includes('zalo.me/g/') ? cls.zaloLink.replace('zalo.me/g/', 'chat.zalo.me/?g=') : cls.zaloLink} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center text-xs text-blue-600 hover:text-blue-800 transition-colors">
                                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                                Zalo Nhóm
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!syncedDashboardCovers.has(cls.name) && (
                            <button
                              onClick={() => handleSyncDashboardCover(cls.name)}
                              disabled={syncingDashboardCover === cls.name}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Đồng bộ Tờ bìa nội dung lớp (Bài tập, Lý thuyết)"
                            >
                              <RefreshCw className={`w-5 h-5 ${syncingDashboardCover === cls.name ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleSyncClassCover(cls.name)}
                            disabled={syncingClassCover === cls.name}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Đồng bộ Tờ bìa học sinh"
                          >
                            <RefreshCw className={`w-5 h-5 ${syncingClassCover === cls.name ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingClass(cls);
                              setEditClassData({ name: cls.name, block: cls.block, zaloLink: cls.zaloLink || '' });
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Chỉnh sửa lớp"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setClassToDelete(cls.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Xóa lớp"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setEditingClass(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-6">Chỉnh sửa Lớp</h3>
            <form onSubmit={handleUpdateClass} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Khối</label>
                <select 
                  value={editClassData.block} 
                  onChange={e => setEditClassData({...editClassData, block: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                >
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên lớp</label>
                <input 
                  type="text" 
                  required 
                  value={editClassData.name} 
                  onChange={e => setEditClassData({...editClassData, name: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Link Zalo nhóm (không bắt buộc)</label>
                <input 
                  type="url" 
                  value={editClassData.zaloLink} 
                  onChange={e => setEditClassData({...editClassData, zaloLink: e.target.value})} 
                  placeholder="https://zalo.me/g/..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" 
                />
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingClass}
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isUpdatingClass ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingFbStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cập nhật Liên hệ</h3>
            <p className="text-sm text-gray-600 mb-4">Học sinh: <span className="font-semibold">{editingFbStudent.name}</span></p>
            <form onSubmit={handleUpdateContact}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Đường link Facebook</label>
                  <input type="url" value={editFbData.facebook} onChange={e => setEditFbData({...editFbData, facebook: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="https://facebook.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Số điện thoại Zalo</label>
                  <input type="tel" value={editFbData.zalo} onChange={e => setEditFbData({...editFbData, zalo: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="0912..." />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingFbStudent(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Student Details Modal */}
      {viewingStudentDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-gray-900">Thông tin chi tiết Học sinh</h3>
                <button 
                  onClick={() => {
                    setEditingStudent(viewingStudentDetails);
                    setEditStudentData({ 
                      name: viewingStudentDetails.name, 
                      className: viewingStudentDetails.className || '', 
                      email: viewingStudentDetails.email || '', 
                      password: viewingStudentDetails.plainPassword || viewingStudentDetails.password || '',
                      dob: viewingStudentDetails.dob || '',
                      schoolInfo: viewingStudentDetails.schoolInfo || '',
                      address: viewingStudentDetails.address || '',
                      zalo: viewingStudentDetails.zalo || '',
                      facebook: viewingStudentDetails.facebook || '',
                      parentName: viewingStudentDetails.parentName || '',
                      parentRelation: viewingStudentDetails.parentRelation || '',
                      parentPhone: viewingStudentDetails.parentPhone || ''
                    });
                    setUpdateStudentError('');
                    setViewingStudentDetails(null);
                  }}
                  className="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors flex items-center"
                >
                  <Edit className="w-4 h-4 mr-1.5" />
                  Chỉnh sửa
                </button>
              </div>
              <button 
                onClick={() => setViewingStudentDetails(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Thông tin cá nhân</h4>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Họ và tên</span>
                      <span className="text-gray-900 font-medium">{viewingStudentDetails.name}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Ngày sinh</span>
                      <span className="text-gray-900">{viewingStudentDetails.dob ? viewingStudentDetails.dob.split('-').reverse().join('/') : <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Lớp</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {viewingStudentDetails.className}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Trường</span>
                      <span className="text-gray-900">{viewingStudentDetails.schoolInfo || <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Địa chỉ</span>
                      <span className="text-gray-900">{viewingStudentDetails.address || <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Thông tin liên hệ</h4>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Email đăng nhập</span>
                      <span className="text-gray-900">{viewingStudentDetails.email}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Số Zalo/SĐT Học sinh</span>
                      <span className="text-gray-900">{viewingStudentDetails.zalo || <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Facebook cá nhân</span>
                      {viewingStudentDetails.facebook ? (
                        <a 
                          href={viewingStudentDetails.facebook.startsWith('http') ? viewingStudentDetails.facebook : `https://${viewingStudentDetails.facebook}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                        >
                          {viewingStudentDetails.facebook}
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">Chưa cập nhật</span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <span className="block text-xs font-semibold text-indigo-500 mb-1">Phụ huynh (Họ tên)</span>
                      <span className="text-gray-900 font-medium">{viewingStudentDetails.parentName || <span className="text-gray-400 italic text-sm">Chưa cập nhật</span>}</span>
                      {viewingStudentDetails.parentRelation && <span className="ml-2 text-xs text-gray-500">({viewingStudentDetails.parentRelation})</span>}
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-indigo-500 mb-1">Số điện thoại Phụ huynh</span>
                      <span className="text-gray-900 font-medium">{viewingStudentDetails.parentPhone || <span className="text-gray-400 italic text-sm">Chưa cập nhật</span>}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Essay Modal */}
      {essayToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-rose-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa bài tập tự luận</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa bài tập này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setEssayToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteEssay} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-rose-600 hover:bg-rose-700">
                Xóa bài tập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Student Exams Modal */}
      {viewingStudentExams && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Bài làm của học sinh</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-semibold text-indigo-600">{viewingStudentExams.name}</span> - Lớp {viewingStudentExams.className}
                </p>
              </div>
              <button onClick={() => setViewingStudentExams(null)} className="text-gray-400 hover:text-gray-500 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              {(() => {
                const assignedExamsList = exams.filter(exam => 
                  exam.status === 'published' && 
                  exam.assignedClasses && 
                  exam.assignedClasses.includes(viewingStudentExams.className)
                );

                const assignedEssaysList = essays.filter(essay => 
                  essay.status === 'published' && 
                  essay.assignedClasses && 
                  essay.assignedClasses.includes(viewingStudentExams.className)
                );

                return (
                  <>
                    {/* Section 1: TRẮC NGHIỆM */}
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center border-b border-slate-100 pb-2">
                        <Calculator className="w-4 h-4 mr-1.5 text-indigo-500" /> Bài tập Trắc nghiệm ({assignedExamsList.length})
                      </h4>
                      {assignedExamsList.length === 0 ? (
                        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                          Chưa có bài trắc nghiệm nào được giao cho lớp này.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {assignedExamsList.map(exam => {
                            const submission = exam.submissionSummary?.find((s: any) => s.studentId === (viewingStudentExams.uid || viewingStudentExams.id));
                            const isCompleted = !!submission;
                            
                            return (
                              <div key={exam.id} className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-sm hover:border-indigo-100 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                  <h5 className="font-semibold text-gray-900 text-sm md:text-base">{exam.title}</h5>
                                  <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                                    <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-slate-400" /> {exam.duration} phút</span>
                                    {isCompleted ? (
                                      <span className="flex items-center text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-lg text-[11px] border border-emerald-100">
                                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Đã nộp bài
                                      </span>
                                    ) : (
                                      <span className="flex items-center text-amber-600 font-bold bg-amber-50 px-2.5 py-0.5 rounded-lg text-[11px] border border-amber-100">
                                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> Chưa làm
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[120px]">
                                  {isCompleted && (
                                    <div className="text-right">
                                      <div className="text-xl font-black text-indigo-600 leading-none">{submission.score}</div>
                                      <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1">Điểm số</div>
                                    </div>
                                  )}
                                  
                                  {isCompleted && (
                                    <button
                                      onClick={() => {
                                        window.open(`/teacher/exam/${exam.id}/result/${viewingStudentExams.uid || viewingStudentExams.id}`, '_blank');
                                      }}
                                      className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-colors whitespace-nowrap"
                                    >
                                      Chi tiết
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Section 2: TỰ LUẬN */}
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center border-b border-slate-100 pb-2 mt-4">
                        <FileText className="w-4 h-4 mr-1.5 text-amber-500" /> Bài tập Tự luận ({assignedEssaysList.length})
                      </h4>
                      {assignedEssaysList.length === 0 ? (
                        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                          Chưa có bài tự luận nào được giao cho lớp này.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {assignedEssaysList.map(essay => {
                            const submission = essay.submissionSummary?.find((s: any) => s.studentId === (viewingStudentExams.uid || viewingStudentExams.id));
                            const isCompleted = !!submission;
                            
                            let scoreText = '';
                            let badgeText = 'Chưa làm';
                            let badgeColor = 'text-amber-600 bg-amber-50 border border-amber-100';
                            
                            if (isCompleted && submission) {
                              if (submission.status === 'graded') {
                                scoreText = submission.score;
                                badgeText = 'Đã chấm';
                                badgeColor = 'text-indigo-600 bg-indigo-50 border border-indigo-100';
                              } else if (submission.status === 'grading' || submission.status === 'grading_in_progress') {
                                badgeText = 'Đang chấm (AI)';
                                badgeColor = 'text-amber-600 bg-amber-50 border border-amber-100 animate-pulse';
                              } else if (submission.status === 'grading_failed' || submission.status === 'key_error') {
                                badgeText = 'Lỗi chấm AI';
                                badgeColor = 'text-rose-600 bg-rose-50 border border-rose-100';
                              } else {
                                badgeText = 'Chờ chấm';
                                badgeColor = 'text-blue-600 bg-blue-50 border border-blue-100';
                              }
                            }

                            return (
                              <div key={essay.id} className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-amber-100 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                  <h5 className="font-semibold text-gray-900 text-sm md:text-base">{essay.title}</h5>
                                  <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                                    {essay.duration ? (
                                      <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-slate-400" /> {essay.duration} phút</span>
                                    ) : null}
                                    <span className={`flex items-center font-bold px-2.5 py-0.5 rounded-lg text-[11px] ${badgeColor}`}>
                                      {isCompleted ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <AlertCircle className="w-3.5 h-3.5 mr-1" />}
                                      {badgeText}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[120px]">
                                  {isCompleted && scoreText !== '' && (
                                    <div className="text-right">
                                      <div className="text-xl font-black text-amber-600 leading-none">{scoreText}</div>
                                      <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1">Điểm số</div>
                                    </div>
                                  )}
                                  
                                  {isCompleted && (
                                    <button
                                      onClick={() => {
                                        window.open(`/teacher/essay/${essay.id}/results?studentId=${viewingStudentExams.uid || viewingStudentExams.id}`, '_blank');
                                      }}
                                      className="px-3.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl font-bold text-xs transition-colors whitespace-nowrap"
                                    >
                                      Xem bài làm
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Chỉnh sửa Học sinh</h3>
              <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            {updateStudentError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                {updateStudentError}
              </div>
            )}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <form id="edit-student-form" onSubmit={handleUpdateStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Họ và tên</label>
                  <input type="text" required value={editStudentData.name} onChange={e => setEditStudentData({...editStudentData, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lớp</label>
                  <input type="text" required value={editStudentData.className} onChange={e => setEditStudentData({...editStudentData, className: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ngày sinh (DD-MM-YYYY)</label>
                  <input type="text" value={editStudentData.dob} onChange={e => setEditStudentData({...editStudentData, dob: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="VD: 15-08-2005" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Trường học</label>
                  <input type="text" value={editStudentData.schoolInfo} onChange={e => setEditStudentData({...editStudentData, schoolInfo: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Địa chỉ</label>
                  <input type="text" value={editStudentData.address} onChange={e => setEditStudentData({...editStudentData, address: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email (Tài khoản đăng nhập)</label>
                  <input type="email" required value={editStudentData.email} onChange={e => setEditStudentData({...editStudentData, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
                  <input type="text" required value={editStudentData.password} onChange={e => setEditStudentData({...editStudentData, password: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  <p className="mt-1 text-xs text-gray-500">Đổi email/mật khẩu sẽ thay đổi tài khoản đăng nhập.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Số Zalo/SĐT</label>
                  <input type="text" value={editStudentData.zalo} onChange={e => setEditStudentData({...editStudentData, zalo: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Facebook (Link)</label>
                  <input type="text" value={editStudentData.facebook} onChange={e => setEditStudentData({...editStudentData, facebook: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Họ tên Phụ huynh</label>
                  <input type="text" value={editStudentData.parentName} onChange={e => setEditStudentData({...editStudentData, parentName: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">SĐT Phụ huynh</label>
                  <input type="text" value={editStudentData.parentPhone} onChange={e => setEditStudentData({...editStudentData, parentPhone: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
              </form>
            </div>
            <div className="pt-4 flex justify-end space-x-3 mt-4 border-t border-gray-100">
              <button type="button" onClick={() => setEditingStudent(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" disabled={isUpdatingStudent}>
                Hủy
              </button>
              <button type="submit" form="edit-student-form" className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center" disabled={isUpdatingStudent}>
                {isUpdatingStudent ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Student Modal */}
      {studentToTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
              <ArrowRightLeft className="w-5 h-5 mr-2 text-indigo-500" />
              Chuyển lớp cho học sinh
            </h3>
            <p className="text-gray-600 mb-6 text-sm">
              Bạn đang chuyển học sinh <span className="font-semibold text-gray-900">{studentToTransfer.name}</span> từ lớp <span className="font-semibold text-gray-900">{studentToTransfer.className}</span> sang lớp mới. Vui lòng chọn lớp đích bên dưới:
            </p>
            
            <div className="mb-6">
              <select
                value={targetTransferClass}
                onChange={(e) => setTargetTransferClass(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 bg-slate-50"
              >
                <option value="">-- Chọn lớp đích --</option>
                {teacherClasses
                  .filter(c => c.name !== studentToTransfer.className)
                  .map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))
                }
              </select>
            </div>

            {transferStudentError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                {transferStudentError}
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setStudentToTransfer(null);
                  setTargetTransferClass('');
                  setTransferStudentError('');
                }} 
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                disabled={isTransferringStudent}
              >
                Hủy
              </button>
              <button 
                onClick={handleTransferStudent} 
                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center" 
                disabled={isTransferringStudent || !targetTransferClass}
              >
                {isTransferringStudent ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang chuyển...</>
                ) : (
                  'Xác nhận chuyển'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirm Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa học sinh</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa học sinh này không? Hành động này không thể hoàn tác và sẽ xóa cả tài khoản đăng nhập của học sinh.
            </p>
            {deleteStudentError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                {deleteStudentError}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button onClick={() => {
                setStudentToDelete(null);
                setDeleteStudentError('');
              }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" disabled={isDeletingStudent}>
                Hủy
              </button>
              <button onClick={handleDeleteStudent} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center" disabled={isDeletingStudent}>
                {isDeletingStudent ? 'Đang xóa...' : 'Xóa học sinh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Students Confirm Modal */}
      {isDeletingAll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa TOÀN BỘ học sinh</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa <strong>tất cả {students.length} học sinh</strong> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setIsDeletingAll(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteAllStudents} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Xóa toàn bộ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Knowledge Confirm Modal */}
      {knowledgeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa tài liệu</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa tài liệu này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setKnowledgeToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteKnowledge} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center">
                Xóa tài liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Knowledge Modal */}
      {editingKnowledge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Sửa thông tin tài liệu</h3>
            <form onSubmit={handleUpdateKnowledge} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tên bài học</label>
                <input type="text" required value={editingKnowledge.title} onChange={e => setEditingKnowledge({...editingKnowledge, title: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Khối</label>
                <select value={editingKnowledge.block} onChange={e => setEditingKnowledge({...editingKnowledge, block: e.target.value, className: ''})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Lớp (Tùy chọn)</label>
                <select value={editingKnowledge.className} onChange={e => setEditingKnowledge({...editingKnowledge, className: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="">-- Dành cho tất cả các lớp trong khối --</option>
                  {teacherClasses.filter(c => c.block === editingKnowledge.block).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Link tài liệu</label>
                <input type="url" required value={editingKnowledge.fileUrl} onChange={e => setEditingKnowledge({...editingKnowledge, fileUrl: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingKnowledge(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" disabled={isUpdatingKnowledge}>
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center" disabled={isUpdatingKnowledge}>
                  {isUpdatingKnowledge ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Exam Confirm Modal */}
      {examToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa đề thi</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa đề thi này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setExamToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteExam} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Xóa đề thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Time Modal */}
      {examToExtend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Gia hạn thời gian</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian kết thúc mới</label>
              <input 
                type="datetime-local" 
                value={newEndTime} 
                onChange={(e) => setNewEndTime(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setExamToExtend(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleExtendTime} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Time Essay Modal */}
      {essayToExtend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Gia hạn thời gian tự luận</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian kết thúc mới</label>
              <input 
                type="datetime-local" 
                value={newEndTime} 
                onChange={(e) => setNewEndTime(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => {
                setEssayToExtend(null);
                setNewEndTime('');
              }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleExtendTimeEssay} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Essay Confirm Modal */}
      {essayToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa bài tập tự luận</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa bài tập tự luận này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setEssayToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteEssay} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Xóa bài tập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirm Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa lớp học</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa lớp này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setClassToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteClass} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center">
                Xóa lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Modal */}
      {rankingExam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl transform transition-all">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-5 flex justify-between items-center text-white relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20 transform rotate-12">
                <Trophy className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-extrabold flex items-center drop-shadow-md">
                  <Medal className="w-6 h-6 mr-2" /> Bảng Vàng Thành Tích
                </h3>
                <p className="text-amber-50 mt-1 text-xs font-medium opacity-90 truncate max-w-xs">{rankingExam.title}</p>
              </div>
              <button onClick={() => setRankingExam(null)} className="relative z-10 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 bg-slate-50 relative">
              {(() => {
                if (isLoadingRanking) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                      <p className="text-slate-500 font-medium">Đang tải bảng xếp hạng...</p>
                    </div>
                  );
                }

                if (!rankingData || rankingData.length === 0) {
                  return (
                    <div className="text-center py-8 flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                        <Trophy className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">Chưa có kết quả hoặc học sinh nào nộp bài.</p>
                      <p className="text-slate-400 text-xs mt-1">Bảng xếp hạng sẽ hiển thị khi có kết quả đầu tiên.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 relative z-10">
                    {rankingData.map((student: any, index: number) => {
                      const rankColors = [
                        'bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-400 shadow-yellow-200/50',
                        'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-800 border-slate-300 shadow-slate-300/50',
                        'bg-gradient-to-r from-amber-500 to-amber-700 text-amber-50 border-amber-600 shadow-amber-600/30',
                        'bg-white border-slate-200 text-slate-600 shadow-sm',
                        'bg-white border-slate-200 text-slate-600 shadow-sm'
                      ];
                      
                      const rankIcons = [
                        <Trophy className="w-4 h-4 text-yellow-900" />,
                        <Medal className="w-4 h-4 text-slate-800" />,
                        <Award className="w-4 h-4 text-amber-50" />,
                        <span className="font-bold w-4 text-center text-slate-400">4</span>,
                        <span className="font-bold w-4 text-center text-slate-400">5</span>
                      ];
                      
                      const isTop3 = index < 3;
                      
                      return (
                        <div key={index} className={`flex items-center justify-between p-3 rounded-xl border-2 ${rankColors[index]} ${isTop3 ? 'shadow-md transform hover:-translate-y-0.5' : 'hover:border-indigo-200 hover:shadow-sm'} transition-all duration-300 relative overflow-hidden group`}>
                          {isTop3 && (
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl transform translate-x-8 -translate-y-8 group-hover:translate-x-4 transition-transform duration-700" />
                          )}
                          <div className="flex items-center space-x-3 relative z-10">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${isTop3 ? 'bg-white/20 backdrop-blur-sm' : 'bg-slate-100'}`}>
                              {rankIcons[index]}
                            </div>
                            <div>
                              <p className={`font-bold ${isTop3 ? 'text-base' : 'text-sm text-slate-700'}`}>{student.studentName}</p>
                              <p className={`text-[10px] mt-0.5 ${isTop3 ? 'opacity-80 font-medium' : 'text-slate-500'}`}>
                                {new Date(student.submittedAt).toLocaleString('vi-VN')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right relative z-10">
                            <div className={`font-black text-xl drop-shadow-sm`}>
                              {student.score}
                            </div>
                            <div className={`text-[9px] uppercase tracking-wider font-bold ${isTop3 ? 'opacity-75' : 'text-slate-400'}`}>Điểm</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={() => {
                  const medalEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                  let message = `🏆 BẢNG VÀNG THÀNH TÍCH 🏆\n📌 ${rankingExam.title}\n\n`;
                  rankingData.forEach((student, index) => {
                    message += `${medalEmojis[index] || '🏅'} Hạng ${index + 1}: ${student.studentName} - ${student.score} điểm\n`;
                  });
                  message += `\n🎉 Chúc mừng các em!`;
                  navigator.clipboard.writeText(message).catch(err => console.error("Failed to copy message:", err));
                  window.open('https://chat.zalo.me/', '_blank', 'noopener,noreferrer');
                }}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-md flex items-center"
              >
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Gửi Zalo
              </button>
              <button
                onClick={() => setRankingExam(null)}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Modal */}
      {notifyModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
              <Send className="w-5 h-5 mr-2 text-indigo-500" />
              Thông báo nhóm
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Chọn lớp cần thông báo</label>
              <select
                value={selectedNotifyClass}
                onChange={(e) => setSelectedNotifyClass(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 bg-slate-50"
              >
                <option value="">-- Chọn lớp --</option>
                {notifyModalItem.assignedClasses && notifyModalItem.assignedClasses.map((cls: string) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setNotifyModalItem(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={executeNotify}
                disabled={!selectedNotifyClass}
                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Gửi Zalo
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}
