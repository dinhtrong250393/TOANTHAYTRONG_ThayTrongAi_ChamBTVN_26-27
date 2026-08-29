import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { ChevronDown, ChevronRight, BookOpen, FileText, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudentTextbookTab({ essays, submissions }: { essays: any[], submissions: any[] }) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<any[]>([]);
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!appUser?.className) return;

    const fetchTextbookTree = async () => {
      setLoading(true);
      try {
        // 1. Fetch lessons assigned to this class
        const lessonsQ = query(
          collection(db, 'textbook_lessons'),
          where('assignedClasses', 'array-contains', appUser.className)
        );
        const lessonsSnap = await getDocs(lessonsQ);
        const lessonsData = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (lessonsData.length === 0) {
          setTree([]);
          setLoading(false);
          return;
        }

        // 2. Fetch chapters
        const chapterIds = Array.from(new Set(lessonsData.map(l => l.chapterId).filter(Boolean)));
        let chaptersData: any[] = [];
        if (chapterIds.length > 0) {
          // Firestore 'in' query supports up to 30 items. We assume < 30 chapters for a single class at once.
          // For robustness, chunk if needed.
          const chunks = [];
          for (let i = 0; i < chapterIds.length; i += 30) {
            chunks.push(chapterIds.slice(i, i + 30));
          }
          
          for (const chunk of chunks) {
            const chapQ = query(collection(db, 'textbook_chapters'), where(documentId(), 'in', chunk));
            const snap = await getDocs(chapQ);
            chaptersData = chaptersData.concat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }
        }

        // 3. Fetch grades
        const gradeIds = Array.from(new Set(chaptersData.map(c => c.gradeId).filter(Boolean)));
        let gradesData: any[] = [];
        if (gradeIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < gradeIds.length; i += 30) {
            chunks.push(gradeIds.slice(i, i + 30));
          }
          
          for (const chunk of chunks) {
            const gradeQ = query(collection(db, 'textbook_grades'), where(documentId(), 'in', chunk));
            const snap = await getDocs(gradeQ);
            gradesData = gradesData.concat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }
        }

        // 4. Build Tree
        // Exercises are inside `essays` prop where `textbookLessonId` matches
        const tbExercises = essays.filter(e => e.textbookLessonId);
        
        const builtTree = gradesData.map(grade => {
          const gradeChapters = chaptersData
            .filter(c => c.gradeId === grade.id)
            .map(chapter => {
              const chapterLessons = lessonsData
                .filter(l => l.chapterId === chapter.id)
                .map(lesson => {
                  const lessonExercises = tbExercises.filter(e => e.textbookLessonId === lesson.id);
                  return {
                    ...lesson,
                    exercises: lessonExercises
                  };
                });
              return {
                ...chapter,
                lessons: chapterLessons
              };
            });
          return {
            ...grade,
            chapters: gradeChapters
          };
        });

        // Sort them (optional, relies on createdAt or title)
        builtTree.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        setTree(builtTree);

        // Expand all initially to show content
        const initExpGrades: Record<string, boolean> = {};
        const initExpChaps: Record<string, boolean> = {};
        const initExpLessons: Record<string, boolean> = {};
        builtTree.forEach(g => {
          initExpGrades[g.id] = true;
          g.chapters.forEach((c: any) => {
            initExpChaps[c.id] = true;
            c.lessons.forEach((l: any) => {
              initExpLessons[l.id] = true;
            });
          });
        });
        
        setExpandedGrades(initExpGrades);
        setExpandedChapters(initExpChaps);
        setExpandedLessons(initExpLessons);

      } catch (err) {
        console.error("Error fetching textbook tree:", err);
      }
      setLoading(false);
    };

    fetchTextbookTree();
  }, [appUser, essays]);

  const toggleGrade = (id: string) => setExpandedGrades(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleChapter = (id: string) => setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleLesson = (id: string) => setExpandedLessons(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có bài tập Sách giáo khoa</h3>
        <p className="text-gray-500">Giáo viên chưa giao bài tập nào thuộc sách giáo khoa cho lớp của bạn.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
          Mục lục Bài tập SGK
        </h3>
      </div>
      <div className="p-4 md:p-6 space-y-4">
        {tree.map(grade => (
          <div key={grade.id} className="border border-indigo-100 rounded-xl overflow-hidden bg-white">
            <div 
              className="px-4 py-3 bg-indigo-50/50 flex justify-between items-center cursor-pointer hover:bg-indigo-50 transition-colors"
              onClick={() => toggleGrade(grade.id)}
            >
              <h4 className="font-bold text-indigo-900 flex items-center text-lg">
                {expandedGrades[grade.id] ? <ChevronDown className="w-5 h-5 mr-2 text-indigo-500" /> : <ChevronRight className="w-5 h-5 mr-2 text-indigo-500" />}
                {grade.name}
              </h4>
            </div>
            
            {expandedGrades[grade.id] && (
              <div className="p-4 space-y-4">
                {grade.chapters.length === 0 && <p className="text-sm text-gray-500 italic pl-6">Chưa có nội dung</p>}
                
                {grade.chapters.map((chapter: any) => (
                  <div key={chapter.id} className="ml-2 md:ml-6 border border-slate-100 rounded-lg overflow-hidden">
                    <div 
                      className="px-4 py-2 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => toggleChapter(chapter.id)}
                    >
                      <h5 className="font-semibold text-slate-800 flex items-center">
                        {expandedChapters[chapter.id] ? <ChevronDown className="w-4 h-4 mr-2 text-slate-500" /> : <ChevronRight className="w-4 h-4 mr-2 text-slate-500" />}
                        {chapter.name}
                      </h5>
                    </div>
                    
                    {expandedChapters[chapter.id] && (
                      <div className="p-3 space-y-3">
                        {chapter.lessons.length === 0 && <p className="text-sm text-gray-500 italic pl-6">Chưa có bài học</p>}
                        
                        {chapter.lessons.map((lesson: any) => (
                          <div key={lesson.id} className="ml-2 md:ml-6 border border-emerald-50 rounded-lg overflow-hidden bg-white">
                            <div 
                              className="px-4 py-2 bg-emerald-50/50 flex justify-between items-center cursor-pointer hover:bg-emerald-50 transition-colors"
                              onClick={() => toggleLesson(lesson.id)}
                            >
                              <h6 className="font-medium text-emerald-900 flex items-center text-sm md:text-base">
                                {expandedLessons[lesson.id] ? <ChevronDown className="w-4 h-4 mr-2 text-emerald-600" /> : <ChevronRight className="w-4 h-4 mr-2 text-emerald-600" />}
                                {lesson.name}
                              </h6>
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                                {lesson.exercises.length} bài tập
                              </span>
                            </div>
                            
                            {expandedLessons[lesson.id] && (
                              <div className="p-3 bg-white">
                                {lesson.exercises.length === 0 && <p className="text-sm text-gray-500 italic pl-6">Chưa có bài tập nào</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 md:pl-6">
                                  {lesson.exercises.map((exercise: any) => {
                                    // check if student has submitted
                                    const hasSubmitted = submissions.some(s => s.essayId === exercise.id);
                                    
                                    return (
                                      <Link 
                                        key={exercise.id} 
                                        to={`/student/essay/${exercise.id}`}
                                        className={`block border rounded-xl p-4 transition-all hover:shadow-md ${
                                          hasSubmitted ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300' : 'border-slate-200 hover:border-indigo-300'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex items-start space-x-3">
                                            <div className={`p-2 rounded-lg ${hasSubmitted ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                              {hasSubmitted ? <CheckCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                            </div>
                                            <div>
                                              <h3 className="font-bold text-slate-800 line-clamp-2">{exercise.title || 'Bài tập'}</h3>
                                              <p className={`text-xs mt-1 font-medium ${hasSubmitted ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                {hasSubmitted ? 'Đã nộp bài' : 'Chưa làm'}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
