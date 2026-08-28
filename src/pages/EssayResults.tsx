import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, syncEssayResultsCover } from '../lib/firebase';
import { triggerZaloCampaign } from '../lib/zaloUtils';
import { syncClassStudentsCover } from '../lib/syncUtils';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, Image as ImageIcon, FileText, CheckCircle, AlertCircle, RefreshCw, X, FileEdit, Calculator, Users, BarChart3, Send, Trash2, Sparkles, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize, UserCheck, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { gradeEssayClient } from '../lib/grader';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

const renderMathChildren = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string') {
    const processedText = children
      .replace(/\\\(/g, () => '$')
      .replace(/\\\)/g, () => '$')
      .replace(/\\\[/g, () => '$$')
      .replace(/\\\]/g, () => '$$');
    return <Latex>{processedText}</Latex>;
  }
  if (Array.isArray(children)) {
    return children.map((child, idx) => (
      <React.Fragment key={idx}>{renderMathChildren(child)}</React.Fragment>
    ));
  }
  return children;
};

function ImageViewer({ images, initialIndex, onClose }: { images: string[], initialIndex: number, onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
      resetZoom();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      resetZoom();
    }
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <button onClick={onClose} className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50">
        <X className="w-6 h-6" />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 p-2 rounded-2xl backdrop-blur-md z-50">
        <button onClick={handleZoomOut} className="p-2 text-white hover:bg-white/20 rounded-xl transition-colors">
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-white font-medium min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} className="p-2 text-white hover:bg-white/20 rounded-xl transition-colors">
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-white/20 mx-2"></div>
        <button onClick={resetZoom} className="p-2 text-white hover:bg-white/20 rounded-xl transition-colors" title="Fit Screen">
          <Maximize className="w-5 h-5" />
        </button>
      </div>

      {currentIndex > 0 && (
        <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50">
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {currentIndex < images.length - 1 && (
        <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50">
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 font-medium bg-black/50 px-4 py-2 rounded-full z-50">
        Ảnh {currentIndex + 1} / {images.length}
      </div>

      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          src={images[currentIndex]} 
          alt={`Bài làm ${currentIndex + 1}`}
          className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-200"
          style={{ 
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
          onClick={() => zoom === 1 && handleZoomIn()}
          draggable={false}
        />
      </div>
    </div>
  );
}

export default function EssayResults() {
  const { essayId } = useParams<{ essayId: string }>();
  const location = useLocation();
  const [essay, setEssay] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [loadingFullSubmission, setLoadingFullSubmission] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingGrade, setIsEditingGrade] = useState(false);
  const [editedScore, setEditedScore] = useState('');
  const [editedFeedback, setEditedFeedback] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState<number | null>(null);

  const handleSelectSubmission = async (sub: any) => {
    if (!sub) {
      setSelectedSubmission(null);
      setIsEditingGrade(false);
      return;
    }
    // Set basic info instantly to prevent transition lag
    setSelectedSubmission(sub);
    setIsEditingGrade(false);
    setLoadingFullSubmission(true);
    try {
      const subDoc = await getDoc(doc(db, 'essay_submissions', sub.id));
      if (subDoc.exists()) {
        setSelectedSubmission({ id: subDoc.id, ...subDoc.data() });
      }
    } catch (err) {
      console.error("Lỗi tải chi tiết bài làm:", err);
    } finally {
      setLoadingFullSubmission(false);
    }
  };

  // Keep full details in sync if the summary status updates (e.g., grading finishes)
  useEffect(() => {
    if (!selectedSubmission) return;
    const currentSubInList = submissions.find(s => s.id === selectedSubmission.id);
    if (currentSubInList && currentSubInList.status !== selectedSubmission.status) {
      const fetchFull = async () => {
        try {
          const subDoc = await getDoc(doc(db, 'essay_submissions', selectedSubmission.id));
          if (subDoc.exists()) {
            setSelectedSubmission({ id: subDoc.id, ...subDoc.data() });
          }
        } catch (err) {
          console.error("Lỗi tự động cập nhật chi tiết bài làm:", err);
        }
      };
      fetchFull();
    }
  }, [submissions, selectedSubmission]);

  const [isGrading, setIsGrading] = useState(false);
  const [gradingError, setGradingError] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingNotificationData, setLoadingNotificationData] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [selectedNotifyClass, setSelectedNotifyClass] = useState<string>('');
  const [selectedFilterClass, setSelectedFilterClass] = useState<string>('ALL');
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGradingAll, setIsGradingAll] = useState(false);
  const [gradingProgress, setGradingProgress] = useState({ total: 0, current: 0 });
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [showBatchSuccess, setShowBatchSuccess] = useState(false);
  const [noUngradedAlert, setNoUngradedAlert] = useState(false);
  const [batchGradingIds, setBatchGradingIds] = useState<string[]>([]);
   // oops need useAuth if used? Actually no need for useAuth here unless it's missing.
  
  const sortedSubmissions = React.useMemo(() => {
    return [...submissions].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }, [submissions]);

  const scoreData = React.useMemo(() => {
    const counts: Record<string, number> = {
      '0.0': 0, '0.5': 0, '1.0': 0, '1.5': 0, '2.0': 0, '2.5': 0, '3.0': 0, '3.5': 0, '4.0': 0, '4.5': 0,
      '5.0': 0, '5.5': 0, '6.0': 0, '6.5': 0, '7.0': 0, '7.5': 0, '8.0': 0, '8.5': 0, '9.0': 0, '9.5': 0, '10.0': 0
    };
    
    submissions.forEach(sub => {
      if (sub.status === 'graded') {
        const score = parseFloat(sub.score);
        if (!isNaN(score)) {
          const roundedScore = (Math.round(score * 2) / 2).toFixed(1);
          if (counts[roundedScore] !== undefined) {
            counts[roundedScore]++;
          }
        }
      }
    });

    return Object.keys(counts).map(score => ({
      name: score,
      count: counts[score]
    }));
  }, [submissions]);

  const updateBothSubAndEssay = async (submissionId: string, updates: any) => {
    // 1. Update the submission document (1 Write)
    const subRef = doc(db, 'essay_submissions', submissionId);
    await updateDoc(subRef, updates);

    if (!essayId) return;

    // 2. Locally compute the updated summary
    const updatedSubmissions = submissions.map(s => {
      if (s.id === submissionId) {
        return { ...s, ...updates };
      }
      return s;
    });

    // 3. Write directly to the inner results cover sheet (essay_results_cover)
    // This is 1 Write and 0 Reads!
    const coverRef = doc(db, 'essay_results_cover', essayId);
    await setDoc(coverRef, {
      submissionSummary: updatedSubmissions
    }, { merge: true });

    // Update local React state directly
    setSubmissions(updatedSubmissions);
    setEssay(prev => {
      if (!prev) return prev;
      return { ...prev, submissionSummary: updatedSubmissions };
    });
    setSelectedSubmission(prev => {
      if (prev && prev.id === submissionId) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  };

  const handleDeleteSubmission = async () => {
    if (!submissionToDelete) return;
    setIsDeleting(true);
    try {
      const sub = submissions.find(s => s.id === submissionToDelete);
      
      await deleteDoc(doc(db, 'essay_submissions', submissionToDelete));
      
      if (sub && sub.studentId) {
        const userRef = doc(db, 'users', sub.studentId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.completedEssays) {
            try {
              const newCompletedEssays = userData.completedEssays.filter((c: any) => c.essayId !== essayId);
              await updateDoc(userRef, { completedEssays: newCompletedEssays });
            } catch (err) {
              console.error("Lỗi cập nhật user doc:", err);
            }
          }
        }
      }

      // Remove from essay.submissionSummary
      if (essayId) {
        const essayRef = doc(db, 'essays', essayId);
        const essaySnap = await getDoc(essayRef);
        if (essaySnap.exists()) {
          const essayData = essaySnap.data();
          const summary = essayData.submissionSummary || [];
          const newSummary = summary.filter((item: any) => item.id !== submissionToDelete);
          await updateDoc(essayRef, { submissionSummary: newSummary });
          await updateDoc(doc(db, 'essays_metadata', essayId), { submissionSummary: newSummary }).catch(err => console.warn("Failed to update essays_metadata:", err));
        }
        
        // Sync inner cover sheet for the essay results
        await syncEssayResultsCover(essayId);
      }

      setSubmissions(submissions.filter(s => s.id !== submissionToDelete));
      setEssay(prev => {
        if (!prev) return prev;
        const summary = prev.submissionSummary || [];
        const newSummary = summary.filter((item: any) => item.id !== submissionToDelete);
        return { ...prev, submissionSummary: newSummary };
      });
      if (selectedSubmission?.id === submissionToDelete) {
        setSelectedSubmission(null);
      }
      setSubmissionToDelete(null);
    } catch (error) {
      console.error("Lỗi khi xóa bài làm:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!essayId) return;
    
    setLoading(true);

    const loadData = async () => {
      try {
        const coverDoc = await getDoc(doc(db, 'essay_results_cover', essayId));
        let submissionsList = [];
        let essayData = null;

        // Fetch original essay doc to get images and solution text
        const essayDoc = await getDoc(doc(db, 'essays', essayId));
        const originalEssayData = essayDoc.exists() ? essayDoc.data() : {};

        if (coverDoc.exists()) {
          const coverData = coverDoc.data();
          submissionsList = coverData.submissionSummary || [];
          essayData = {
            id: essayId,
            ...originalEssayData,
            title: coverData.title || originalEssayData.title || '',
            submissionSummary: submissionsList
          };
        } else {
          // Fallback or Sync: fetch and sync first
          const cover = await syncEssayResultsCover(essayId);
          submissionsList = cover.submissionSummary || [];
          essayData = {
            id: essayId,
            ...originalEssayData,
            title: cover.title || originalEssayData.title || '',
            submissionSummary: submissionsList
          };
        }

        setEssay(essayData);
        setSubmissions(submissionsList);

        // Auto-select student if studentId is passed in search query
        const params = new URLSearchParams(window.location.search);
        const urlStudentId = params.get('studentId');
        if (urlStudentId) {
          const subToSelect = submissionsList.find((s: any) => s.studentId === urlStudentId);
          if (subToSelect) {
            setSelectedSubmission(subToSelect);
            setLoadingFullSubmission(true);
            getDoc(doc(db, 'essay_submissions', subToSelect.id)).then(subDoc => {
              if (subDoc.exists()) {
                setSelectedSubmission({ id: subDoc.id, ...subDoc.data() });
              }
            }).catch(err => {
              console.error("Error loading auto-selected submission:", err);
            }).finally(() => {
              setLoadingFullSubmission(false);
            });
          }
        }

        // Fetch students immediately to show class groupings
        let studs: any[] = [];
        if (essayData && essayData.assignedClasses && essayData.assignedClasses.length > 0) {
          for (const cls of essayData.assignedClasses) {
            const classCoverDoc = await getDoc(doc(db, 'class_students_cover', cls));
            if (classCoverDoc.exists()) {
              const data = classCoverDoc.data();
              studs = studs.concat((data.students || []).map((s: any) => ({ ...s, className: cls })));
            } else {
              const syncStuds = await syncClassStudentsCover(cls);
              studs = studs.concat((syncStuds || []).map((s: any) => ({ ...s, className: cls })));
            }
          }
        }
        setStudents(studs);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [essayId]);

  const handleManualRefresh = async () => {
    if (!essayId) return;
    setIsRefreshing(true);
    try {
      // Refresh by forcing sync of the essay results cover first
      const cover = await syncEssayResultsCover(essayId);
      
      const essayDoc = await getDoc(doc(db, 'essays', essayId));
      const originalEssayData = essayDoc.exists() ? essayDoc.data() : {};

      const submissionsList = cover.submissionSummary || [];
      const essayData: any = {
        id: essayId,
        ...originalEssayData,
        title: cover.title || originalEssayData.title || '',
        submissionSummary: submissionsList
      };
      
      setEssay(essayData);
      setSubmissions(submissionsList);

      // Fetch students immediately to show class groupings
      let studs: any[] = [];
      if (essayData && essayData.assignedClasses && essayData.assignedClasses.length > 0) {
        for (const cls of essayData.assignedClasses) {
          const classCoverDoc = await getDoc(doc(db, 'class_students_cover', cls));
          if (classCoverDoc.exists()) {
            const data = classCoverDoc.data();
            studs = studs.concat((data.students || []).map((s: any) => ({ ...s, className: cls })));
          } else {
            const syncStuds = await syncClassStudentsCover(cls);
            studs = studs.concat((syncStuds || []).map((s: any) => ({ ...s, className: cls })));
          }
        }
      }
      setStudents(studs);
      
      if (selectedSubmission) {
        const freshSub = submissionsList.find((s: any) => s.id === selectedSubmission.id);
        if (freshSub) {
          const subDoc = await getDoc(doc(db, 'essay_submissions', selectedSubmission.id));
          if (subDoc.exists()) {
            setSelectedSubmission({ id: subDoc.id, ...subDoc.data() });
          } else {
            setSelectedSubmission(freshSub);
          }
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải lại dữ liệu:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Reactive progress tracker for batch grading
  useEffect(() => {
    if (!isGradingAll || batchGradingIds.length === 0) return;

    const finishedCount = submissions.filter(s => 
      batchGradingIds.includes(s.id) && 
      (s.status === 'graded' || s.status === 'grading_failed' || s.status === 'key_error')
    ).length;

    setGradingProgress(prev => ({ ...prev, current: finishedCount }));

    if (finishedCount === batchGradingIds.length) {
      setIsGradingAll(false);
      setBatchGradingIds([]);
      setShowBatchSuccess(true);
    }
  }, [submissions, isGradingAll, batchGradingIds]);

  const handleGradeAI = async (submission: any) => {
    setIsGrading(true);
    setGradingError('');
    try {
              await updateBothSubAndEssay(submission.id, { status: 'grading_in_progress' });

        const { aiFeedback, score } = await gradeEssayClient(submission, essay);

        const newSubData = {
          aiFeedback: aiFeedback,
          score: score,
          status: 'graded',
          gradedAt: new Date().getTime()
        };

        await updateBothSubAndEssay(submission.id, newSubData);
        
        // Update student's profile completed essays
        try {
          const userRef = doc(db, 'users', submission.studentId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const completedEssays = userData.completedEssays || [];
            const index = completedEssays.findIndex((c: any) => c.essayId === essayId);
            if (index !== -1) {
              completedEssays[index] = {
                ...completedEssays[index],
                score: score,
                status: 'graded'
              };
              await updateDoc(userRef, { completedEssays });
            } else {
              completedEssays.push({
                essayId: essayId,
                submissionId: submission.id,
                score: score,
                status: 'graded',
                submittedAt: submission.submittedAt || new Date().toISOString()
              });
              await updateDoc(userRef, { completedEssays });
            }
          }
        } catch (userErr) {
          console.error("Lỗi cập nhật hồ sơ học sinh:", userErr);
        }
    } catch (err: any) {
      setGradingError('Lỗi chấm điểm: ' + err.message);
        try {
          await updateBothSubAndEssay(submission.id, {
            status: 'grading_failed',
            errorMsg: err.message || 'Lỗi chấm bài.'
          });
        } catch (upErr) {
          console.error("Lỗi cập nhật trạng thái thất bại:", upErr);
        }
    } finally {
      setIsGrading(false);
    }
  };

  const handleStartEdit = () => {
    if (!selectedSubmission) return;
    setEditedScore(selectedSubmission.score !== undefined && selectedSubmission.score !== null ? selectedSubmission.score.toString() : '0');
    setEditedFeedback(selectedSubmission.aiFeedback || '');
    setIsEditingGrade(true);
  };

  const handleSaveEditGrade = async () => {
    if (!selectedSubmission) return;
    const scoreVal = parseFloat(editedScore);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 10) {
      alert('Vui lòng nhập điểm số hợp lệ từ 0 đến 10.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const newSubData = {
        aiFeedback: editedFeedback,
        score: scoreVal,
        status: 'graded',
        gradedAt: new Date().getTime()
      };

      await updateBothSubAndEssay(selectedSubmission.id, newSubData);

      // Update student's profile completed essays
      try {
        const userRef = doc(db, 'users', selectedSubmission.studentId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const completedEssays = userData.completedEssays || [];
          const index = completedEssays.findIndex((c: any) => c.essayId === essayId);
          if (index !== -1) {
            completedEssays[index] = {
              ...completedEssays[index],
              score: scoreVal,
              status: 'graded'
            };
            await updateDoc(userRef, { completedEssays });
          } else {
            completedEssays.push({
              essayId: essayId,
              submissionId: selectedSubmission.id,
              score: scoreVal,
              status: 'graded',
              submittedAt: selectedSubmission.submittedAt || new Date().toISOString()
            });
            await updateDoc(userRef, { completedEssays });
          }
        }
      } catch (userErr) {
        console.error("Lỗi cập nhật hồ sơ học sinh:", userErr);
      }

      setIsEditingGrade(false);
      alert('Cập nhật điểm và nhận xét thành công!');
    } catch (err: any) {
      alert("Lỗi khi cập nhật điểm: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleGradeAllAI = () => {
    const ungradedSubs = submissions.filter(s => s.status !== 'graded' && s.status !== 'grading' && s.status !== 'grading_in_progress');
    if (ungradedSubs.length === 0) {
      setNoUngradedAlert(true);
      return;
    }
    setShowBatchConfirm(true);
  };

  const startBatchGrading = async () => {
    setShowBatchConfirm(false);
    const ungradedSubs = submissions.filter(s => s.status !== 'graded' && s.status !== 'grading' && s.status !== 'grading_in_progress');
    if (ungradedSubs.length === 0) return;

    const ids = ungradedSubs.map(s => s.id);
    setBatchGradingIds(ids);
    setIsGradingAll(true);
    setGradingProgress({ total: ids.length, current: 0 });

          let count = 0;
      for (const sub of ungradedSubs) {
        try {
          await updateBothSubAndEssay(sub.id, { status: 'grading_in_progress' });

          const { aiFeedback, score } = await gradeEssayClient(sub, essay);

          const newSubData = {
            aiFeedback: aiFeedback,
            score: score,
            status: 'graded',
            gradedAt: new Date().getTime()
          };

          await updateBothSubAndEssay(sub.id, newSubData);

          // Update student's profile completed essays
          try {
            const userRef = doc(db, 'users', sub.studentId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              const completedEssays = userData.completedEssays || [];
              const index = completedEssays.findIndex((c: any) => c.essayId === essayId);
              if (index !== -1) {
                completedEssays[index] = {
                  ...completedEssays[index],
                  score: score,
                  status: 'graded'
                };
                await updateDoc(userRef, { completedEssays });
              } else {
                completedEssays.push({
                  essayId: essayId,
                  submissionId: sub.id,
                  score: score,
                  status: 'graded',
                  submittedAt: sub.submittedAt || new Date().toISOString()
                });
                await updateDoc(userRef, { completedEssays });
              }
            }
          } catch (userErr) {
            console.error("Lỗi cập nhật hồ sơ học sinh:", userErr);
          }
        } catch (err: any) {
          console.error('Lỗi khi chấm bài cho', sub.studentName, err);
          try {
            await updateBothSubAndEssay(sub.id, {
              status: 'grading_failed',
              errorMsg: err.message || 'Lỗi chấm bài.'
            });
          } catch (upErr) {
            console.error("Lỗi cập nhật trạng thái thất bại:", upErr);
          }
        }
        count++;
        setGradingProgress({ total: ungradedSubs.length, current: count });
        await new Promise(res => setTimeout(res, 3500)); // Wait 3.5s to avoid hitting Gemini 15 RPM free quota
      }
      setIsGradingAll(false);
      setBatchGradingIds([]);
      setShowBatchSuccess(true);
  };

  const handleNotify = async (sub: any) => {
    try {
      // Priority 1: Use embedded contact details if present
      let zalo = sub.studentZalo || null;
      let facebook = sub.studentFacebook || null;

      // Priority 2: Fall back to lazy loading if not present
      if (!zalo && !facebook && sub.studentId) {
        console.log(`[Lazy Loading] Fetching student contact info: ${sub.studentId}`);
        const userDoc = await getDoc(doc(db, 'users', sub.studentId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          zalo = userData.zalo || null;
          facebook = userData.facebook || null;

          // Locally update submissions list and selected submission so we don't query again next time
          setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, studentZalo: zalo, studentFacebook: facebook } : s));
          if (selectedSubmission && selectedSubmission.id === sub.id) {
            setSelectedSubmission(prev => prev ? { ...prev, studentZalo: zalo, studentFacebook: facebook } : null);
          }
        }
      }

      const studentName = sub.studentName;
      const message = `🎉 KẾT QUẢ BÀI TỰ LUẬN 🎉\n\nChào ${studentName}, em đã hoàn thành bài: "${essay.title || 'Bài tập'}"\n\n🎯 Điểm số: ${sub.score || 0} / 10 điểm.\n👉 Hãy tiếp tục cố gắng nhé!\n🔗 Xem lại bài làm: ${window.location.origin}`;
      
      await navigator.clipboard.writeText(message);
      
      if (zalo) {
        window.open(`https://chat.zalo.me/?phone=${zalo}`, '_blank', 'noopener,noreferrer');
      } else if (facebook) {
        window.open(facebook, '_blank', 'noopener,noreferrer');
      } else {
        window.open(`https://chat.zalo.me/`, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error("Lỗi khi gửi thông báo:", err);
      window.open(`https://chat.zalo.me/`, '_blank', 'noopener,noreferrer');
    }
  };

  const loadNotificationData = async () => {
    if (classes.length > 0 && students.length > 0) return;
    setLoadingNotificationData(true);
    try {
      const qClasses = query(collection(db, 'classes'));
      const classesSnap = await getDocs(qClasses);
      const classesList = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classesList);

      let studs: any[] = [];
      if (essay && essay.assignedClasses && essay.assignedClasses.length > 0) {
        for (const cls of essay.assignedClasses) {
          const coverDoc = await getDoc(doc(db, 'class_students_cover', cls));
          if (coverDoc.exists()) {
            const data = coverDoc.data();
            studs = studs.concat((data.students || []).map((s: any) => ({ ...s, className: cls })));
          } else {
            const syncStuds = await syncClassStudentsCover(cls);
            studs = studs.concat((syncStuds || []).map((s: any) => ({ ...s, className: cls })));
          }
        }
      }
      setStudents(studs);
    } catch (err) {
      console.error("Error loading notification data:", err);
    } finally {
      setLoadingNotificationData(false);
    }
  };

  const notifyScoreZalo = (target: 'student' | 'parent') => {
    if (!essay) return;
    const gradedSubs = submissions.filter(s => s.status === 'graded' && s.score !== undefined && s.score !== null);
    if (gradedSubs.length === 0) {
      alert("Chưa có học sinh nào được chấm điểm để gửi.");
      return;
    }
    const campaignData: Array<{ phone: string, message: string }> = [];
    for (const sub of gradedSubs) {
      const student = students.find(s => s.uid === sub.studentId || s.name === sub.studentName);

      // Filter by selected class if specified
      if (selectedFilterClass !== 'ALL') {
        const studentClass = sub.studentClass || (student && student.className) || '';
        if (studentClass !== selectedFilterClass) continue;
      }

      if (target === 'student') {
        const zalo = (student && student.zalo) || sub.studentZalo || null;
        if (!zalo) continue;
        const msg = `Chào em: ${sub.studentName}. Hiện tại đã có kết quả bài tự luận: ${essay.title || 'Tự luận'}. Điểm số của em: ${sub.score} / 10. Em đăng nhập hệ thống để xem chi tiết bài làm nhé!`;
        campaignData.push({ phone: zalo, message: msg });
      } else {
        const parentPhone = student?.parentPhone || null;
        if (!parentPhone) continue;
        const className = student?.className || sub.studentClass || '';
        const classStr = className ? ` - Lớp: ${className}` : '';
        const msg = `Kính gửi Phụ huynh của học sinh: ${sub.studentName}${classStr}: Đã có kết quả bài tự luận "${essay.title || 'Tự luận'}". Điểm số của em đạt: ${sub.score} / 10. Kính báo Phụ huynh theo dõi tình hình học tập của con!`;
        campaignData.push({ phone: parentPhone, message: msg });
      }
    }

    if (campaignData.length === 0) {
      const targetLabel = target === 'student' ? 'học sinh' : 'phụ huynh';
      const classLabel = selectedFilterClass === 'ALL' ? '' : ` của lớp ${selectedFilterClass}`;
      alert(`Không tìm thấy số Zalo/SĐT của ${targetLabel} nào có điểm${classLabel}. Vui lòng kiểm tra lại danh bạ.`);
      return;
    }
    triggerZaloCampaign(campaignData);
  };

  const notifyNotDoneZalo = (target: 'student' | 'parent') => {
    if (!essay || !students || students.length === 0) {
      alert("Danh sách học sinh trống hoặc chưa giao cho lớp nào.");
      return;
    }
    const campaignData: Array<{ phone: string, message: string }> = [];
    const submittedStudentIds = new Set(submissions.map(s => s.studentId).filter(Boolean));
    const submittedStudentNames = new Set(submissions.map(s => s.studentName).filter(Boolean));

    const targetStudents = selectedFilterClass === 'ALL' 
      ? students 
      : students.filter(s => s.className === selectedFilterClass);

    for (const s of targetStudents) {
      const isDone = (s.uid && submittedStudentIds.has(s.uid)) || (s.name && submittedStudentNames.has(s.name));
      if (!isDone) {
        if (target === 'student') {
          if (s.zalo) {
            const msg = `Chào em: ${s.name}. Thầy nhắc em hiện tại có bài tập tự luận chưa nộp: ${essay.title || 'Tự luận'}. Em nhớ đăng nhập vào nộp bài trước hạn nhé!`;
            campaignData.push({ phone: s.zalo, message: msg });
          }
        } else {
          if (s.parentPhone) {
            const classStr = s.className ? ` - Lớp: ${s.className}` : '';
            const msg = `Kính gửi Phụ huynh của học sinh: ${s.name}${classStr}: Hiện tại em vẫn CHƯA NỘP bài tập tự luận "${essay.title || 'Tự luận'}". Kính nhờ Phụ huynh nhắc nhở con vào nộp bài trước hạn!`;
            campaignData.push({ phone: s.parentPhone, message: msg });
          }
        }
      }
    }

    if (campaignData.length === 0) {
      const targetLabel = target === 'student' ? 'học sinh' : 'phụ huynh';
      const classLabel = selectedFilterClass === 'ALL' ? '' : ` thuộc lớp ${selectedFilterClass}`;
      alert(`Tất cả ${targetLabel}${classLabel} đều đã nộp bài hoặc chưa có số điện thoại.`);
      return;
    }
    triggerZaloCampaign(campaignData);
  };

  const executeSendSummaryZalo = () => {
    if (!selectedNotifyClass) return;

    const filteredStudents = students.filter(s => s.className === selectedNotifyClass);

    const doneStudents = filteredStudents.filter(student => 
      submissions.some(sub => sub.studentId === student.uid)
    ).map(student => {
      const sub = submissions.find(s => s.studentId === student.uid);
      return { name: student.name, score: sub?.score, status: sub?.status };
    }).sort((a, b) => {
      const scoreA = typeof a.score === 'number' ? a.score : -1;
      const scoreB = typeof b.score === 'number' ? b.score : -1;
      return scoreB - scoreA;
    });

    const notDoneStudents = filteredStudents.filter(student => 
      !submissions.some(sub => sub.studentId === student.uid)
    );

    let message = `📊 KẾT QUẢ TỰ LUẬN: ${essay.title || 'Bài tập'} (LỚP ${selectedNotifyClass}) 📊\n\n`;

    if (doneStudents.length > 0) {
      message += `✅ ĐÃ NỘP BÀI (${doneStudents.length}):\n`;
      doneStudents.forEach((st, idx) => {
        const scoreStr = st.status === 'graded' && st.score !== undefined && st.score !== null
          ? `${st.score} điểm`
          : 'Đang chấm / Chưa có điểm';
        message += `${idx + 1}. ${st.name}: ${scoreStr}\n`;
      });
      message += `\n`;
    }

    if (notDoneStudents.length > 0) {
      message += `❌ CHƯA NỘP BÀI (${notDoneStudents.length}):\n`;
      notDoneStudents.forEach((st, idx) => {
        message += `${idx + 1}. ${st.name}\n`;
      });
      message += `\n`;
    }

    message += `👉 Link đăng nhập: ${window.location.origin}`;

    navigator.clipboard.writeText(message).catch(err => console.error("Failed to copy", err));
    
    // Find class Zalo link
    const classInfo = classes.find(c => c.name === selectedNotifyClass);
    if (classInfo && classInfo.zaloLink) {
      let webLink = classInfo.zaloLink;
      if (webLink.includes('zalo.me/g/')) {
        webLink = webLink.replace('zalo.me/g/', 'chat.zalo.me/?g=');
      }
      window.open(webLink, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://chat.zalo.me/', '_blank', 'noopener,noreferrer');
    }
    
    setShowNotifyModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !essay) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Đã có lỗi xảy ra</h2>
        <p className="text-slate-600 mb-6">{error || 'Không tìm thấy bài tập'}</p>
        <Link to="/teacher" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold">
          Quay lại Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center">
              <Link to="/teacher" className="p-2.5 -ml-2.5 mr-3 md:mr-4 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Kết quả Tự luận: {essay.title}
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-3">
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1.5 text-indigo-500" />
                    Đã nhận <strong className="ml-1 text-indigo-600">{submissions.length}</strong> bài nộp
                  </span>
                  {essay.assignedClasses && essay.assignedClasses.length > 0 && (
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                      Lớp: {essay.assignedClasses.join(', ')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter by class */}
              {essay.assignedClasses && essay.assignedClasses.length > 0 && (
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 mr-1">
                  <Filter className="w-4 h-4 text-slate-500 mr-2" />
                  <select
                    value={selectedFilterClass}
                    onChange={(e) => setSelectedFilterClass(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
                    title="Chọn lớp để gửi tin Zalo"
                  >
                    <option value="ALL">Tất cả các lớp</option>
                    {essay.assignedClasses.map((c: string) => (
                      <option key={c} value={c}>Lớp {c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Báo điểm Học sinh */}
              <button 
                onClick={() => notifyScoreZalo('student')} 
                className="flex items-center px-3 py-1.5 md:px-3.5 md:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-xl text-xs md:text-sm font-semibold hover:bg-emerald-100 transition-colors shadow-sm"
                title="Gửi điểm Zalo cho Học sinh"
              >
                <Send className="w-4 h-4 mr-1.5 text-emerald-600" />
                <span>Báo điểm HS</span>
              </button>

              {/* Nhắc chưa làm Học sinh */}
              <button 
                onClick={() => notifyNotDoneZalo('student')} 
                className="flex items-center px-3 py-1.5 md:px-3.5 md:py-2 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-xl text-xs md:text-sm font-semibold hover:bg-amber-100 transition-colors shadow-sm"
                title="Gửi tin Zalo nhắc Học sinh chưa nộp bài"
              >
                <AlertCircle className="w-4 h-4 mr-1.5 text-amber-600" />
                <span>Nhắc chưa nộp HS</span>
              </button>

              {/* Báo điểm Phụ huynh */}
              <button 
                onClick={() => notifyScoreZalo('parent')} 
                className="flex items-center px-3 py-1.5 md:px-3.5 md:py-2 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-xl text-xs md:text-sm font-semibold hover:bg-blue-100 transition-colors shadow-sm"
                title="Gửi tin Zalo báo điểm tự luận cho Phụ huynh"
              >
                <UserCheck className="w-4 h-4 mr-1.5 text-blue-600" />
                <span>Báo điểm Phụ huynh</span>
              </button>

              {/* Nhắc chưa làm Phụ huynh */}
              <button 
                onClick={() => notifyNotDoneZalo('parent')} 
                className="flex items-center px-3 py-1.5 md:px-3.5 md:py-2 bg-orange-50 text-orange-700 border border-orange-200/60 rounded-xl text-xs md:text-sm font-semibold hover:bg-orange-100 transition-colors shadow-sm"
                title="Gửi tin Zalo nhắc Phụ huynh đôn đốc con nộp bài tự luận"
              >
                <Users className="w-4 h-4 mr-1.5 text-orange-600" />
                <span>Nhắc Phụ huynh</span>
              </button>

              {/* Thông báo nhóm Zalo */}
              <button
                onClick={async () => {
                  if (essay.assignedClasses && essay.assignedClasses.length > 0) {
                    setSelectedNotifyClass(selectedFilterClass !== 'ALL' ? selectedFilterClass : essay.assignedClasses[0]);
                  }
                  setShowNotifyModal(true);
                  await loadNotificationData();
                }}
                className="flex items-center px-3 py-1.5 md:px-3.5 md:py-2 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-xl text-xs md:text-sm font-semibold hover:bg-indigo-100 transition-colors shadow-sm"
                title="Gửi bảng tổng hợp điểm vào nhóm Zalo"
              >
                <Send className="w-4 h-4 mr-1.5 text-indigo-600" />
                <span>Báo nhóm</span>
              </button>

              {/* Nút Làm mới */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center px-3 py-1.5 md:px-3 md:py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl font-bold text-xs md:text-sm transition-colors shadow-sm"
                title="Tải lại dữ liệu"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* List of submissions */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-500" /> Danh sách bài nộp
              </h2>
              {submissions.length > 0 && (
                <button
                  onClick={handleGradeAllAI}
                  disabled={isGradingAll}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center"
                >
                  {isGradingAll ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {gradingProgress.current}/{gradingProgress.total}</>
                  ) : (
                    'Chấm đồng loạt'
                  )}
                </button>
              )}
            </div>
            
            {submissions.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-slate-500">Chưa có bài nộp.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const groupedSubmissions = sortedSubmissions.reduce((acc, sub) => {
                    const student = students.find(s => s.uid === sub.studentId) || { className: 'Khác' };
                    const className = sub.studentClass || student.className || 'Khác';
                    if (!acc[className]) acc[className] = [];
                    acc[className].push(sub);
                    return acc;
                  }, {} as Record<string, any[]>);

                  const sortedClasses = Object.keys(groupedSubmissions).sort((a, b) => {
                    if (a === 'Khác') return 1;
                    if (b === 'Khác') return -1;
                    return a.localeCompare(b);
                  });

                  return sortedClasses.map(className => (
                    <details key={className} className="group bg-white shadow-sm rounded-3xl border border-slate-200/60 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="px-5 py-4 bg-slate-50/50 hover:bg-slate-100/50 border-b border-slate-100 rounded-3xl group-open:rounded-b-none cursor-pointer outline-none flex justify-between items-center transition-colors list-none">
                        <h3 className="text-base font-bold text-slate-800 flex items-center">
                          {className === 'Khác' ? 'Khác' : `Lớp ${className}`}
                          <span className="ml-3 bg-indigo-100 text-indigo-700 py-0.5 px-2.5 rounded-full text-xs font-semibold">
                            {groupedSubmissions[className].length} bài
                          </span>
                        </h3>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="overflow-hidden">
                        <ul className="divide-y divide-slate-100">
                          {groupedSubmissions[className].map((sub, idx) => {
                    const student = students.find(s => s.uid === sub.studentId) || { name: sub.studentName };
                    
                    return (
                    <li key={sub.id}>
                      <div 
                        onClick={() => handleSelectSubmission(sub)}
                        className={`w-full cursor-pointer text-left px-5 py-5 hover:bg-slate-50 transition-all ${selectedSubmission?.id === sub.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{sub.studentName}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(sub.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                          {sub.status === 'graded' ? (
                            <div className="text-lg font-black text-indigo-600">{sub.score}</div>
                          ) : (sub.status === 'grading' || sub.status === 'grading_in_progress') ? (
                            <div className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg animate-pulse flex items-center">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Đang chấm...
                            </div>
                          ) : (sub.status === 'grading_failed' || sub.status === 'key_error') ? (
                            <div className="text-xs font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-lg">Lỗi chấm</div>
                          ) : (
                            <div className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">Chưa chấm</div>
                          )}
                        </div>
                      </div>
                    </li>
                  )})}
                </ul>
                      </div>
                    </details>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Submission details & Grading */}
          <div className="lg:col-span-8">
            {selectedSubmission ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative">
                {loadingFullSubmission && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-3xl">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Đang tải chi tiết bài làm...</p>
                  </div>
                )}
                <div className="flex justify-between items-start mb-8 pb-8 border-b border-slate-100">
                   <div>
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedSubmission.studentName}</h2>
                     <p className="text-slate-500 mt-2 mb-5 font-medium flex items-center space-x-2">
                       <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold text-slate-600">Lớp {selectedSubmission.studentClass || 'N/A'}</span>
                       <span className="text-slate-300">•</span>
                       <span className="text-sm">{new Date(selectedSubmission.submittedAt).toLocaleString()}</span>
                     </p>
                     
                     <div className="flex space-x-3">
                        <button
                          onClick={() => handleNotify(selectedSubmission)}
                          className="flex items-center px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold text-sm transition-colors shadow-sm"
                        >
                          <Send className="w-4 h-4 mr-2" /> Báo điểm
                        </button>
                        <button
                          onClick={() => setSubmissionToDelete(selectedSubmission.id)}
                          className="flex items-center px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-sm transition-colors shadow-sm"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Xóa bài
                        </button>
                        {!isEditingGrade && (
                          <button
                            onClick={handleStartEdit}
                            className="flex items-center px-4 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl font-bold text-sm transition-colors shadow-sm animate-in fade-in"
                          >
                            <FileEdit className="w-4 h-4 mr-2" /> Sửa điểm & nhận xét
                          </button>
                        )}
                     </div>
                   </div>
                   {selectedSubmission.status === 'graded' && !isEditingGrade && (
                     <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl px-8 py-5 text-center shadow-lg shadow-indigo-200 transform hover:scale-105 transition-transform duration-300">
                       <div className="text-5xl font-black tracking-tighter drop-shadow-sm">{selectedSubmission.score}</div>
                       <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100 mt-1 opacity-90">Điểm số</div>
                     </div>
                   )}
                </div>
                
                {/* Images */}
                {selectedSubmission.images && selectedSubmission.images.length > 0 && (
                  <div className="mb-10">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                      <ImageIcon className="w-5 h-5 mr-2 text-indigo-500" /> Bài làm của học sinh
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedSubmission.images.map((img: string, idx: number) => (
                         <div 
                           key={idx} 
                           className="relative group overflow-hidden rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                           onClick={() => setViewerImageIndex(idx)}
                         >
                           <img src={img} className="w-full object-cover transform group-hover:scale-[1.02] transition-transform duration-500" />
                           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                             <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                           </div>
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Feedback / Edit Section */}
                {isEditingGrade ? (
                  <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5 animate-in fade-in duration-200">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                      <FileEdit className="w-5 h-5 mr-2 text-amber-500 animate-pulse" /> Chỉnh sửa Điểm & Nhận xét của Giáo viên
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Điểm số (0 - 10)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={editedScore}
                          onChange={(e) => setEditedScore(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-extrabold text-indigo-600 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nhận xét & Hướng dẫn sửa đổi</label>
                        <textarea
                          rows={12}
                          value={editedFeedback}
                          onChange={(e) => setEditedFeedback(e.target.value)}
                          placeholder="Nhập nhận xét chi tiết cho bài làm tự luận của học sinh tại đây..."
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setIsEditingGrade(false)}
                        className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                        disabled={isSavingEdit}
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditGrade}
                        disabled={isSavingEdit}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center min-w-[120px]"
                      >
                        {isSavingEdit ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang lưu...</>
                        ) : (
                          'Lưu thay đổi'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center">
                          <Sparkles className="w-6 h-6 mr-3 text-amber-500" /> Đánh giá chi tiết từ AI
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Phân tích từng chi tiết lỗi sai và gợi ý sửa đổi cho bài làm</p>
                      </div>
                      <button 
                        onClick={() => handleGradeAI(selectedSubmission)}
                        disabled={isGrading}
                        className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-md flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGrading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang chấm...</>
                        ) : (
                          <>{(selectedSubmission.status === 'graded' || selectedSubmission.status === 'grading' || selectedSubmission.status === 'grading_in_progress') ? 'Chấm lại bài (AI)' : 'Bắt đầu chấm (AI)'}</>
                        )}
                      </button>
                    </div>
                    
                    {selectedSubmission.status === 'grading_failed' || selectedSubmission.status === 'key_error' ? (
                      <div className="p-8 border-2 border-dashed border-rose-200 bg-rose-50/30 rounded-2xl text-center text-rose-700">
                        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                        <h4 className="font-bold text-base mb-1 text-rose-900">Lỗi chấm điểm tự động</h4>
                        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">{selectedSubmission.errorMsg || 'Đã xảy ra lỗi không xác định trong quá trình xử lý.'}</p>
                        <button 
                          onClick={() => handleGradeAI(selectedSubmission)}
                          className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors shadow-sm"
                        >
                          Thử chấm lại
                        </button>
                      </div>
                    ) : selectedSubmission.status === 'grading' || selectedSubmission.status === 'grading_in_progress' ? (
                      <div className="p-10 border-2 border-dashed border-indigo-100 bg-indigo-50/10 rounded-2xl text-center text-indigo-600">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
                        <h4 className="font-bold text-base mb-1">AI đang chấm bài...</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">Hệ thống đang tiến hành nhận diện hình ảnh bài làm và phân tích để chấm điểm. Vui lòng đợi trong giây lát.</p>
                        {!isGrading && (
                          <div className="mt-4 pt-4 border-t border-indigo-100/50">
                            <p className="text-xs text-slate-500 mb-3">Lưu ý: Nếu màn hình này bị treo quá lâu (hơn 1 phút), có thể do kết nối bị gián đoạn.</p>
                            <button 
                              onClick={() => handleGradeAI(selectedSubmission)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md"
                            >
                              Bấm vào đây để chấm lại ngay
                            </button>
                          </div>
                        )}
                      </div>
                    ) : selectedSubmission.aiFeedback ? (
                      <div className="bg-slate-50 rounded-2xl p-6 md:p-8 shadow-inner overflow-hidden">
                        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
                          <ReactMarkdown
                            components={{
                              h1: ({node, children, ...props}) => <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mt-6 mb-3 flex items-center" {...props}>{renderMathChildren(children)}</h1>,
                              h2: ({node, children, ...props}) => <h2 className="text-lg font-bold text-indigo-900 mt-5 mb-2 flex items-center" {...props}>{renderMathChildren(children)}</h2>,
                              h3: ({node, children, ...props}) => <h3 className="text-md font-semibold text-slate-800 mt-4 mb-2" {...props}>{renderMathChildren(children)}</h3>,
                              p: ({node, children, ...props}) => <p className="text-slate-600 mb-4 text-sm md:text-base leading-relaxed" {...props}>{renderMathChildren(children)}</p>,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                              li: ({node, children, ...props}) => <li className="pl-1 mb-1 text-slate-600 leading-relaxed" {...props}>{renderMathChildren(children)}</li>,
                              blockquote: ({node, children, ...props}) => (
                                <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-500 my-4 bg-indigo-50/50 py-2 rounded-r-xl" {...props}>{renderMathChildren(children)}</blockquote>
                              ),
                              code: ({node, ...props}) => <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-sm" {...props} />,
                              pre: ({node, ...props}) => <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-4 text-xs font-mono" {...props} />,
                            }}
                          >
                            {selectedSubmission.aiFeedback}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500">
                        Chưa có nhận xét AI
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-100 rounded-3xl h-full flex items-center justify-center text-slate-500">
                Chọn một bài làm để xem
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Submission Confirmation Modal */}
      {submissionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Xác nhận xóa kết quả</h3>
            <p className="text-center text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa kết quả bài làm này? Sau khi xóa, học sinh sẽ có thể nộp lại bài thi. Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setSubmissionToDelete(null)} 
                className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button 
                onClick={handleDeleteSubmission} 
                className="px-5 py-2.5 border border-transparent rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Grading Confirmation Modal */}
      {showBatchConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-center w-14 h-14 mx-auto bg-emerald-50 text-emerald-600 rounded-full mb-5 shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-center text-slate-900 mb-3 tracking-tight">Chấm bài đồng loạt</h3>
            <p className="text-center text-sm text-slate-500 leading-relaxed mb-6 font-medium">
              Hệ thống sẽ chấm điểm tự động cho <span className="text-emerald-600 font-extrabold">{submissions.filter(s => s.status !== 'graded').length} bài làm chưa có điểm</span> bằng Thầy Trọng AI. Quá trình này có thể tốn một ít thời gian.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowBatchConfirm(false)} 
                className="w-1/2 px-4 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={startBatchGrading}
                className="w-1/2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-emerald-600/15"
              >
                Bắt đầu chấm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Grading Success Modal */}
      {showBatchSuccess && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-center w-14 h-14 mx-auto bg-emerald-100 text-emerald-600 rounded-full mb-5 shadow-inner">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-center text-slate-900 mb-3 tracking-tight">Chấm xong đồng loạt</h3>
            <p className="text-center text-sm text-slate-500 leading-relaxed mb-6 font-medium">
              Đã hoàn tất quá trình chấm điểm tự động bằng Thầy Trọng AI cho các bài làm chưa chấm.
            </p>
            <div className="flex justify-center">
              <button 
                onClick={() => setShowBatchSuccess(false)}
                className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm transition-all shadow-md"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Ungraded Alert Modal */}
      {noUngradedAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-center w-14 h-14 mx-auto bg-indigo-50 text-indigo-600 rounded-full mb-5 shadow-inner">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-center text-slate-900 mb-3 tracking-tight">Tất cả đã có điểm</h3>
            <p className="text-center text-sm text-slate-500 leading-relaxed mb-6 font-medium">
              Tất cả các bài giải tự luận của học sinh đều đã được chấm điểm xong. Không còn bài làm nào cần chấm đồng loạt.
            </p>
            <div className="flex justify-center">
              <button 
                onClick={() => setNoUngradedAlert(false)}
                className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm transition-all shadow-md"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
              <Send className="w-5 h-5 mr-2 text-indigo-500" />
              Thông báo nhóm
            </h3>
            {loadingNotificationData ? (
              <div className="flex flex-col items-center py-6">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                <p className="text-sm text-slate-500">Đang tải danh sách học sinh...</p>
              </div>
            ) : (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Chọn lớp cần thông báo</label>
                <select
                  value={selectedNotifyClass}
                  onChange={(e) => setSelectedNotifyClass(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 bg-slate-50"
                >
                  <option value="">-- Chọn lớp --</option>
                  {essay.assignedClasses && essay.assignedClasses.map((cls: string) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={executeSendSummaryZalo}
                disabled={!selectedNotifyClass}
                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Gửi Zalo
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerImageIndex !== null && selectedSubmission?.images && (
        <ImageViewer 
          images={selectedSubmission.images} 
          initialIndex={viewerImageIndex} 
          onClose={() => setViewerImageIndex(null)} 
        />
      )}
    </div>
  );
}
