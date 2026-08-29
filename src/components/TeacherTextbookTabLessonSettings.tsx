import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';

export default function TeacherTextbookTabLessonSettings({ 
  lesson, 
  teacherClasses,
  onUpdated 
}: { 
  lesson: any, 
  teacherClasses: any[],
  onUpdated: (updatedLesson: any) => void
}) {
  const [assignedClasses, setAssignedClasses] = useState<string[]>(lesson.assignedClasses || []);
  const [startTime, setStartTime] = useState(lesson.startTime || '');
  const [endTime, setEndTime] = useState(lesson.endTime || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAssignedClasses(lesson.assignedClasses || []);
    setStartTime(lesson.startTime || '');
    setEndTime(lesson.endTime || '');
  }, [lesson]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const lessonRef = doc(db, 'textbook_lessons', lesson.id);
      const updates = {
        assignedClasses,
        startTime,
        endTime,
        updatedAt: Date.now()
      };
      
      await updateDoc(lessonRef, updates);
      
      // Cascade update to all existing child essays
      const q = query(collection(db, 'essays'), where('textbookLessonId', '==', lesson.id));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
          batch.update(d.ref, {
            assignedClasses,
            startTime,
            endTime,
            updatedAt: Date.now()
          });
        });
        await batch.commit();
      }

      onUpdated({ ...lesson, ...updates });
      alert('Đã lưu Cài đặt Giao bài thành công! Toàn bộ Đề nhỏ bên trong đã được cập nhật.');
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi lưu cài đặt');
    }
    setSaving(false);
  };

  const handleClassToggle = (className: string) => {
    setAssignedClasses(prev => 
      prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Giao cho các lớp:</label>
        {teacherClasses.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
            Bạn chưa có lớp học nào. Hãy sang tab Quản lý Lớp để tạo lớp trước!
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teacherClasses.map(cls => (
              <label 
                key={cls.id} 
                className={`flex items-center px-4 py-2 rounded-xl border cursor-pointer transition-all ${
                  assignedClasses.includes(cls.name) 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={assignedClasses.includes(cls.name)}
                  onChange={() => handleClassToggle(cls.name)}
                />
                {cls.name} {cls.block ? `(Khối ${cls.block})` : ''}
              </label>
            ))}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Thời gian Mở đề (Tùy chọn):</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Hạn chót Nộp bài (Tùy chọn):</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>
      
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Lưu Cài đặt
        </button>
      </div>
    </div>
  );
}
