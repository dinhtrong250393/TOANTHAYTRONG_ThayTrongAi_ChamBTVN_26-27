import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { FolderPlus, BookOpen, Plus, Trash2, Edit2, Loader2, ArrowRight, ChevronRight, Folder, Image as ImageIcon, Settings, FileText, MessageCircle, Send, Award, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TeacherTextbookTabLessonSettings from './TeacherTextbookTabLessonSettings';

interface TeacherTextbookTabProps {
  teacherClasses: any[];
  handleZaloNotifyNewTask?: (item: any, className: string) => void;
  setNotifyModalItem?: (item: any) => void;
  setSelectedNotifyClass?: (cls: string) => void;
  setEssayToExtend?: (essay: any) => void;
  setNewEndTime?: (time: string) => void;
  essaySubmissionsCounts?: Record<string, number>;
  handleSyncOldDataEssay?: (id: string) => void;
  syncingEssayId?: string | null;
}

export default function TeacherTextbookTab({ 
  teacherClasses,
  handleZaloNotifyNewTask,
  setNotifyModalItem,
  setSelectedNotifyClass,
  setEssayToExtend,
  setNewEndTime,
  essaySubmissionsCounts = {},
  handleSyncOldDataEssay,
  syncingEssayId
}: TeacherTextbookTabProps) {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  
  const [grades, setGrades] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]); // These are essays
  
  const [currentGrade, setCurrentGrade] = useState<any>(null);
  const [currentChapter, setCurrentChapter] = useState<any>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);

  const [newItemName, setNewItemName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{collection: string, id: string} | null>(null);

  // Fetch Grades
  useEffect(() => {
    if (!appUser?.uid) return;
    const fetchGrades = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'textbook_grades'), where('teacherId', '==', appUser.uid));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
        setGrades(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchGrades();
  }, [appUser]);

  // Fetch Chapters when Grade selected
  useEffect(() => {
    if (!currentGrade) return;
    const fetchChapters = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'textbook_chapters'), where('gradeId', '==', currentGrade.id));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
        setChapters(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchChapters();
  }, [currentGrade]);

  // Fetch Lessons when Chapter selected
  useEffect(() => {
    if (!currentChapter) return;
    const fetchLessons = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'textbook_lessons'), where('chapterId', '==', currentChapter.id));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
        setLessons(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchLessons();
  }, [currentChapter]);

  // Fetch Exercises when Lesson selected
  useEffect(() => {
    if (!currentLesson) return;
    const fetchExercises = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'essays'), where('textbookLessonId', '==', currentLesson.id));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
        setExercises(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchExercises();
  }, [currentLesson]);

  const handleCreate = async () => {
    if (!newItemName.trim() || !appUser?.uid) return;
    setIsCreating(true);
    try {
      if (!currentGrade) {
        // Create Grade
        const docRef = await addDoc(collection(db, 'textbook_grades'), {
          name: newItemName.trim(),
          teacherId: appUser.uid,
          createdAt: Date.now()
        });
        setGrades([...grades, { id: docRef.id, name: newItemName.trim(), teacherId: appUser.uid, createdAt: Date.now() }]);
      } else if (!currentChapter) {
        // Create Chapter
        const docRef = await addDoc(collection(db, 'textbook_chapters'), {
          name: newItemName.trim(),
          gradeId: currentGrade.id,
          teacherId: appUser.uid,
          createdAt: Date.now()
        });
        setChapters([...chapters, { id: docRef.id, name: newItemName.trim(), gradeId: currentGrade.id, teacherId: appUser.uid, createdAt: Date.now() }]);
      } else if (!currentLesson) {
        // Create Lesson
        const docRef = await addDoc(collection(db, 'textbook_lessons'), {
          name: newItemName.trim(),
          chapterId: currentChapter.id,
          teacherId: appUser.uid,
          assignedClasses: [],
          startTime: '',
          endTime: '',
          createdAt: Date.now()
        });
        setLessons([...lessons, { id: docRef.id, name: newItemName.trim(), chapterId: currentChapter.id, teacherId: appUser.uid, assignedClasses: [], startTime: '', endTime: '', createdAt: Date.now() }]);
      }
      setNewItemName('');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi tạo mới!');
    }
    setIsCreating(false);
  };

  const executeDelete = async (collectionName: string, id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
      if (collectionName === 'textbook_grades') setGrades(prev => prev.filter(g => g.id !== id));
      if (collectionName === 'textbook_chapters') setChapters(prev => prev.filter(c => c.id !== id));
      if (collectionName === 'textbook_lessons') setLessons(prev => prev.filter(l => l.id !== id));
      if (collectionName === 'essays') setExercises(prev => prev.filter(e => e.id !== id));
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi xóa!');
    }
  };

  const handleDeleteClick = (collectionName: string, id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setItemToDelete({ collection: collectionName, id });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Breadcrumb Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 md:p-6 flex items-center space-x-2 text-sm md:text-base overflow-x-auto">
        <button 
          onClick={() => { setCurrentGrade(null); setCurrentChapter(null); setCurrentLesson(null); }}
          className={`font-bold whitespace-nowrap flex items-center ${!currentGrade ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
        >
          <BookOpen className="w-5 h-5 mr-2" />
          Kho Sách
        </button>
        
        {currentGrade && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <button 
              onClick={() => { setCurrentChapter(null); setCurrentLesson(null); }}
              className={`font-bold whitespace-nowrap ${!currentChapter ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
            >
              {currentGrade.name}
            </button>
          </>
        )}
        
        {currentChapter && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <button 
              onClick={() => { setCurrentLesson(null); }}
              className={`font-bold whitespace-nowrap ${!currentLesson ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
            >
              {currentChapter.name}
            </button>
          </>
        )}

        {currentLesson && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="font-bold whitespace-nowrap text-indigo-600">
              {currentLesson.name}
            </span>
          </>
        )}
      </div>

      <div className="p-4 md:p-6 bg-slate-50/50 min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            {!currentLesson ? (
              // Directory View
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={`Nhập tên ${!currentGrade ? 'Khối (VD: Khối 12)' : !currentChapter ? 'Chương (VD: Chương 1)' : 'Bài học'}...`}
                    className="w-full sm:flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                    }}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newItemName.trim() || isCreating}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center shadow-sm transition-colors"
                  >
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                    Tạo mới
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex-1">Tên {!currentGrade ? 'Khối' : !currentChapter ? 'Chương' : 'Bài học'}</div>
                    <div className="w-24 text-right">Thao tác</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(!currentGrade ? grades : !currentChapter ? chapters : lessons).map((item) => (
                      <div key={item.id} className="group flex items-center justify-between p-4 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                        onClick={() => {
                          if (!currentGrade) setCurrentGrade(item);
                          else if (!currentChapter) setCurrentChapter(item);
                          else if (!currentLesson) setCurrentLesson(item);
                        }}
                      >
                        <div className="flex items-center flex-1 pr-4">
                          <Folder className="w-8 h-8 text-indigo-300 fill-indigo-100 mr-4 flex-shrink-0 group-hover:text-indigo-400 group-hover:fill-indigo-200 transition-colors" />
                          <h4 className="font-semibold text-slate-800 leading-snug">
                            {item.name}
                          </h4>
                        </div>
                        <div className="flex items-center justify-end space-x-1 w-24">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(!currentGrade ? 'textbook_grades' : !currentChapter ? 'textbook_chapters' : 'textbook_lessons', item.id, e);
                            }} 
                            className="p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Xóa"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                    {(!currentGrade ? grades : !currentChapter ? chapters : lessons).length === 0 && (
                      <div className="text-center py-12">
                        <FolderPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">Thư mục trống. Hãy tạo mục mới.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Lesson Detail View (Exercises and Assignment Settings)
              <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-6 border-b border-slate-200 gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">{currentLesson.name}</h3>
                    <p className="text-slate-500 mt-1 flex items-center">
                      <Settings className="w-4 h-4 mr-1.5" /> 
                      Cài đặt giao bài chung cho tất cả Đề nhỏ
                    </p>
                  </div>
                </div>

                <div className="mb-8">
                  <TeacherTextbookTabLessonSettings 
                    lesson={currentLesson} 
                    teacherClasses={teacherClasses}
                    onUpdated={(updated) => setCurrentLesson(updated)}
                  />
                </div>

                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                  Danh sách các Đề đã cắt ({exercises.length})
                </h4>
                
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <ul className="divide-y divide-gray-100">
                    {exercises.length === 0 ? (
                      <li className="p-8 text-center">
                        <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium mb-4">Chưa có đề nào được cắt.</p>
                        <Link 
                          to={`/teacher/textbook/builder/${currentLesson.id}`}
                          className="inline-block bg-emerald-100 text-emerald-700 px-6 py-3 rounded-xl font-bold hover:bg-emerald-200 transition-colors"
                        >
                          Tải ảnh bài tập lên
                        </Link>
                      </li>
                    ) : (
                      [...exercises].sort((a, b) => {
                                    const extractNum = (str) => {
                                      const m = (str || '').match(/(\d+(?:\.\d+)?)/);
                                      return m ? parseFloat(m[1]) : Infinity;
                                    };
                                    const numA = extractNum(a.title);
                                    const numB = extractNum(b.title);
                                    if (numA !== numB) return numA - numB;
                                    return (a.title || '').localeCompare(b.title || '');
                                  }).map((essay, index) => (
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
                                        {essay.submissionSummary === undefined && handleSyncOldDataEssay && (
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
                                    {handleZaloNotifyNewTask && (
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
                                    )}
                                    {setNotifyModalItem && setSelectedNotifyClass && (
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
                                    )}
                                    {setEssayToExtend && setNewEndTime && (
                                      <button
                                        onClick={() => {
                                          setEssayToExtend(essay);
                                          setNewEndTime(essay.endTime || '');
                                        }}
                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium text-sm transition-colors"
                                      >
                                        Gia hạn
                                      </button>
                                    )}
                                    <Link to={`/teacher/essay/${essay.id}/results`} state={{ essay }} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors">
                                      Xem kết quả
                                    </Link>
                                    <Link
                                      to={`/teacher/essay/${essay.id}/ranking`}
                                      className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                                    >
                                      <Award className="w-4 h-4 mr-1.5" /> Xếp hạng
                                    </Link>
                                    <Link
                                      to={`/teacher/essay/edit/${essay.id}`}
                                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      title="Chỉnh sửa bài"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Link>
                                    <button onClick={(e) => handleDeleteClick('essays', essay.id, e)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Xóa bài">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {itemToDelete && (

        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Xác nhận xóa</h3>
            <p className="text-slate-500 text-center mb-6">Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.</p>
            <div className="flex space-x-3">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setItemToDelete(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); executeDelete(itemToDelete.collection, itemToDelete.id); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-sm"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
