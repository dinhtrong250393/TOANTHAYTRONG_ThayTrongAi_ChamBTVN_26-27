import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, syncEssaysCover, syncEssayResultsCover, uploadBase64ToStorage } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, Loader2, Save, ArrowLeft, Image as ImageIcon, Check, FileText, Trash2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { syncClassSummary, saveEssayMetadata } from '../lib/syncUtils';

export default function EssayBuilder() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const { essayId } = useParams<{ essayId: string }>();

  const [title, setTitle] = useState('');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [originalClasses, setOriginalClasses] = useState<string[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [assignmentImages, setAssignmentImages] = useState<string[]>([]);
  const [solutionImages, setSolutionImages] = useState<string[]>([]);
  const [solutionText, setSolutionText] = useState('');

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(!!essayId);

  const handleOcrSolutions = async () => {
    if (solutionImages.length === 0) {
      setError('Vui lòng tải lên ít nhất một hình ảnh đáp án ở phần 4 trước khi sử dụng tính năng gõ lại tự động.');
      return;
    }
    setIsOcrLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ocr-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: solutionImages,
          type: 'teacher_solution'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi nhận diện OCR từ hình ảnh.');
      }
      setSolutionText(prev => {
        const separator = prev && prev.trim() ? '\n\n' : '';
        return prev + separator + data.text;
      });
    } catch (err: any) {
      setError('Lỗi nhận diện bằng AI: ' + err.message);
    } finally {
      setIsOcrLoading(false);
    }
  };

  useEffect(() => {
    const fetchClasses = async () => {
      if (appUser?.uid) {
        const qClasses = query(collection(db, 'classes'), where('teacherId', '==', appUser.uid));
        const snap = await getDocs(qClasses);
        const classes = snap.docs.map(doc => doc.data());
        setTeacherClasses(classes);
      }
    };
    fetchClasses();

    if (essayId) {
      const fetchEssay = async () => {
        try {
          const docRef = doc(db, 'essays', essayId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.title || '');
            setAssignedClasses(data.assignedClasses || []);
            setOriginalClasses(data.assignedClasses || []);
            setStartTime(data.startTime || '');
            setEndTime(data.endTime || '');
            setAssignmentImages(data.assignmentImages || []);
            setSolutionImages(data.solutionImages || []);
            setSolutionText(data.solutionText || '');
          }
        } catch (error: any) {
          setError('Lỗi tải bài tập: ' + error.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchEssay();
    }
  }, [essayId, appUser]);

  const toggleClass = (className: string) => {
    if (assignedClasses.includes(className)) {
      setAssignedClasses(assignedClasses.filter(c => c !== className));
    } else {
      setAssignedClasses([...assignedClasses, className]);
    }
  };

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            
            const originalKb = (file.size / 1024).toFixed(1);
            const compressedKb = (dataUrl.length * 0.75 / 1024).toFixed(1);
            console.log(`[Smart Compression] File: ${file.name}, Original: ${originalKb} KB, Compressed: ${compressedKb} KB (Ratio: ${((Number(compressedKb) / Number(originalKb)) * 100).toFixed(1)}%)`);
            
            resolve(dataUrl);
          } else {
            reject(new Error('Failed to get canvas context'));
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleAssignmentImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    try {
      setIsSaving(true);
      const base64Images = await Promise.all(files.map(file => processImage(file)));
      setAssignmentImages(prev => [...prev, ...base64Images]);
      setIsSaving(false);
    } catch (err: any) {
      setError('Lỗi đọc ảnh: ' + err.message);
      setIsSaving(false);
    }
    // reset input
    e.target.value = '';
  };

  const handleSolutionImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    try {
      setIsSaving(true);
      const base64Images = await Promise.all(files.map(file => processImage(file)));
      setSolutionImages(prev => [...prev, ...base64Images]);
      setIsSaving(false);
    } catch (err: any) {
      setError('Lỗi đọc ảnh: ' + err.message);
      setIsSaving(false);
    }
    // reset input
    e.target.value = '';
  };

  const removeAssignmentImage = (index: number) => {
    setAssignmentImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeSolutionImage = (index: number) => {
    setSolutionImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Vui lòng nhập tên bài tập.');
      return;
    }
    if (assignedClasses.length === 0) {
      setError('Vui lòng chọn ít nhất một lớp.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Vui lòng chọn thời gian bắt đầu và kết thúc.');
      return;
    }
    if (assignmentImages.length === 0) {
      setError('Vui lòng tải lên ít nhất một hình ảnh đề bài.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (!appUser?.uid) throw new Error("Chưa đăng nhập");

      // Upload base64 images to Storage to prevent huge Firestore documents
      const uploadedAssignmentImages: string[] = [];
      for (let i = 0; i < assignmentImages.length; i++) {
        const img = assignmentImages[i];
        if (img.startsWith('data:')) {
          const url = await uploadBase64ToStorage(img, `essay_assignments/${appUser.uid}_${Date.now()}_assign_${i}.jpg`);
          uploadedAssignmentImages.push(url);
        } else {
          uploadedAssignmentImages.push(img);
        }
      }

      const uploadedSolutionImages: string[] = [];
      for (let i = 0; i < solutionImages.length; i++) {
        const img = solutionImages[i];
        if (img.startsWith('data:')) {
          const url = await uploadBase64ToStorage(img, `essay_solutions/${appUser.uid}_${Date.now()}_sol_${i}.jpg`);
          uploadedSolutionImages.push(url);
        } else {
          uploadedSolutionImages.push(img);
        }
      }

      const essayData = {
        title,
        assignedClasses,
        teacherId: appUser.uid,
        startTime,
        endTime,
        assignmentImages: uploadedAssignmentImages,
        solutionImages: uploadedSolutionImages,
        solutionText,
        type: 'essay',
        updatedAt: new Date().getTime()
      };

      if (essayId) {
        await updateDoc(doc(db, 'essays', essayId), essayData);
        await saveEssayMetadata(essayId, essayData);
        await syncEssayResultsCover(essayId);
      } else {
        const docRef = await addDoc(collection(db, 'essays'), {
          ...essayData,
          createdAt: new Date().getTime(),
        });
        await saveEssayMetadata(docRef.id, {
          ...essayData,
          createdAt: new Date().getTime(),
        });
        await syncEssayResultsCover(docRef.id);
      }
      
      // Sync class summaries for all assigned classes
      const allAffectedClasses = Array.from(new Set([...originalClasses, ...assignedClasses]));
      for (const className of allAffectedClasses) {
        await syncClassSummary(className);
      }
      
      await syncEssaysCover(appUser.uid);
      
      navigate('/teacher');
    } catch (err: any) {
      console.error(err);
      setError('Lỗi lưu bài tập: ' + err.message);
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <div className="flex items-center">
              <Link to="/teacher" className="p-2 -ml-2 mr-2 md:mr-4 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                  {essayId ? 'Chỉnh sửa Bài tập Tự luận' : 'Tạo Bài tập Tự luận Mới'}
                </h1>
                <p className="text-sm text-slate-500 hidden md:block">Thiết lập thông tin và tải lên hình ảnh đề bài</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 md:px-6 md:py-2.5 border border-transparent text-sm md:text-base font-bold rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5"
            >
              {isSaving ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Đang lưu...</>
              ) : (
                <><Save className="w-5 h-5 mr-2" /> Lưu bài tập</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
        {error && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-rose-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow-sm sm:rounded-[2rem] border border-slate-200/60 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 mr-3 text-sm">1</span>
              Thông tin chung
            </h2>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tên bài tập</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-medium transition-colors"
                placeholder="Ví dụ: Bài tập Tự luận Đại số 10"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Thời gian bắt đầu</label>
                <input
                  type="datetime-local"
                  step="1"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Thời gian kết thúc</label>
                <input
                  type="datetime-local"
                  step="1"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Giao cho lớp</label>
              <div className="flex flex-wrap gap-2">
                {teacherClasses.map(c => (
                  <button
                    key={c.name}
                    onClick={() => toggleClass(c.name)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm border ${
                      assignedClasses.includes(c.name)
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {teacherClasses.length === 0 && (
                  <p className="text-sm text-slate-500 italic">Chưa có lớp nào. Hãy tạo lớp ở tab Học sinh trước.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm sm:rounded-[2rem] border border-slate-200/60 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-indigo-50/30">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 mr-3 text-sm">2</span>
              Hình ảnh đề bài
            </h2>
            <p className="text-sm text-slate-500 mt-2 ml-11">Tải lên một hoặc nhiều hình ảnh chứa nội dung đề bài.</p>
          </div>
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap gap-4 mb-4">
              {assignmentImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img} alt={`Đề bài ${idx + 1}`} className="h-32 w-32 object-cover rounded-xl border border-slate-200 shadow-sm" />
                  <button
                    onClick={() => removeAssignmentImage(idx)}
                    className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <label className="h-32 w-32 flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors">
                <Plus className="w-8 h-8 mb-2 opacity-70" />
                <span className="text-xs font-semibold">Thêm ảnh</span>
                <input type="file" accept="image/*" multiple onChange={handleAssignmentImagesChange} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm sm:rounded-[2rem] border border-slate-200/60 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-emerald-50/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 mr-3 text-sm">3</span>
                Lời giải & Đáp án mẫu (Dạng chữ / Công thức)
              </h2>
              <p className="text-sm text-slate-500 mt-2 ml-11">
                Nhập lời giải chi tiết bằng chữ hoặc công thức toán học (Hỗ trợ Markdown và công thức LaTeX ví dụ: $x^2 + y^2 = 9$ hoặc $$V = \frac{4}{3}\pi R^3$$).
              </p>
            </div>
            <button
              type="button"
              onClick={handleOcrSolutions}
              disabled={isOcrLoading || solutionImages.length === 0}
              className={`md:shrink-0 flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all border ${
                solutionImages.length === 0
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white hover:shadow'
              }`}
            >
              {isOcrLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang nhận diện AI...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Gõ lại từ ảnh đáp án (OCR)
                </>
              )}
            </button>
          </div>
          <div className="p-6 md:p-8">
            <textarea
              value={solutionText}
              onChange={e => setSolutionText(e.target.value)}
              rows={8}
              className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium transition-colors font-sans"
              placeholder="Nhập lời giải chi tiết của giáo viên tại đây..."
            />
          </div>
        </div>

        <div className="bg-white shadow-sm sm:rounded-[2rem] border border-slate-200/60 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-emerald-50/30">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 mr-3 text-sm">4</span>
              Hình ảnh đáp án đi kèm (Tùy chọn)
            </h2>
            <p className="text-sm text-slate-500 mt-2 ml-11">Tải lên hình ảnh đáp án/lời giải để học sinh đối chiếu thêm.</p>
          </div>
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap gap-4 mb-4">
              {solutionImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img} alt={`Đáp án ${idx + 1}`} className="h-32 w-32 object-cover rounded-xl border border-slate-200 shadow-sm" />
                  <button
                    onClick={() => removeSolutionImage(idx)}
                    className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <label className="h-32 w-32 flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-xl text-emerald-600 hover:bg-emerald-50 cursor-pointer transition-colors">
                <Plus className="w-8 h-8 mb-2 opacity-70" />
                <span className="text-xs font-semibold">Thêm đáp án</span>
                <input type="file" accept="image/*" multiple onChange={handleSolutionImagesChange} className="hidden" />
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
