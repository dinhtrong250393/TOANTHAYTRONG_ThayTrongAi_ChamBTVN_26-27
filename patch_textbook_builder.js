import fs from 'fs';

const fileContent = `import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { ArrowLeft, Upload, FileImage, Cpu, Loader2, Save, CheckCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TextbookBuilder() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [croppedBase64, setCroppedBase64] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'analyze' | 'review'>('upload');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const runAIAnalysis = async (base64: string) => {
    setIsAnalyzing(true);
    setUploadProgress('Đang tải hình ảnh lên Cloudinary...');
    try {
      // 1. Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', base64);
      formData.append('upload_preset', 'KIEM TRA BAI TAP');
      
      const cloudinaryRes = await fetch('https://api.cloudinary.com/v1_1/ao9sncyh/image/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!cloudinaryRes.ok) throw new Error('Failed to upload to Cloudinary');
      const cloudinaryData = await cloudinaryRes.json();
      const imageUrl = cloudinaryData.secure_url;

      setUploadProgress('Đang gửi cho AI phân tích đề và giải bài...');
      // 2. Call our AI endpoint
      const aiRes = await fetch('/api/solve-textbook-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      });
      
      if (!aiRes.ok) throw new Error('AI analysis failed');
      const aiData = await aiRes.json();

      setAiResult({
        ...aiData,
        imageUrl
      });
      setStep('review');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.');
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
      setUploadProgress('');
    }
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.addEventListener('load', async () => {
        const base64 = reader.result?.toString() || '';
        setCroppedBase64(base64);
        setStep('analyze');
        await runAIAnalysis(base64);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!aiResult || !lessonId || !appUser) return;
    setIsSaving(true);
    
    try {
      // Fetch lesson to inherit assigned classes and time settings
      const lessonDoc = await getDoc(doc(db, 'textbook_lessons', lessonId));
      let assignedClasses = [];
      let startTime = '';
      let endTime = '';
      if (lessonDoc.exists()) {
        const data = lessonDoc.data();
        assignedClasses = data.assignedClasses || [];
        startTime = data.startTime || '';
        endTime = data.endTime || '';
      }

      const essayData = {
        title: aiResult.title || 'Bài tập SGK',
        assignedClasses,
        teacherId: appUser.uid,
        startTime,
        endTime,
        assignmentImages: [aiResult.imageUrl],
        solutionImages: [],
        solutionText: aiResult.solutionText || '',
        questionText: aiResult.questionText || '',
        type: 'essay',
        textbookLessonId: lessonId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await addDoc(collection(db, "essays"), essayData);
      try {
        const { saveEssayMetadata, syncClassSummary } = await import("../lib/syncUtils");
        const { syncEssayResultsCover, syncEssaysCover } = await import("../lib/firebase");
        await saveEssayMetadata(docRef.id, essayData);
        if (syncEssayResultsCover) await syncEssayResultsCover(docRef.id);
        if (assignedClasses && assignedClasses.length > 0) {
          for (const className of assignedClasses) {
            await syncClassSummary(className);
          }
        }
        await syncEssaysCover(appUser.uid);
      } catch (err) { console.error("Sync error", err); }
      
      alert('Đã lưu bài tập thành công!');
      // Option to crop another one or go back
      if (window.confirm('Bạn có muốn tiếp tục tải lên ảnh bài tập khác không?')) {
        setStep('upload');
        setAiResult(null);
        setSelectedFile(null);
        setCroppedBase64('');
      } else {
        navigate('/teacher');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi khi lưu vào CSDL');
    }
    
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/teacher" className="mr-4 p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold text-slate-800">Tải lên bài tập</h1>
          </div>
        </div>
      </div>
      
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        
        {step === 'upload' && (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center">
             <FileImage className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
             <h2 className="text-2xl font-black text-slate-800 mb-4">Tải lên ảnh bài tập</h2>
             <p className="text-slate-500 mb-8 max-w-md mx-auto">
               Chọn ảnh bài tập mà bạn đã cắt sẵn. Hệ thống sẽ ngay lập tức dùng AI để phân tích đề và tự động giải.
             </p>
             
             <label className="inline-flex items-center justify-center bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
               <Upload className="w-5 h-5 mr-2" />
               Chọn ảnh tải lên
               <input type="file" accept="image/*" onChange={onSelectFile} className="hidden" />
             </label>
          </div>
        )}

        {step === 'analyze' && (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center">
             <Cpu className="w-16 h-16 text-indigo-500 mx-auto mb-6 animate-pulse" />
             <h2 className="text-2xl font-black text-slate-800 mb-4">AI đang phân tích...</h2>
             <p className="text-slate-500 mb-6">{uploadProgress}</p>
             <div className="flex justify-center">
               <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
             </div>
          </div>
        )}

        {step === 'review' && aiResult && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2 text-emerald-500" />
                Kiểm tra & Lưu bài tập
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setStep('upload');
                    setAiResult(null);
                  }}
                  className="bg-white text-slate-600 border border-slate-200 px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Chọn ảnh khác
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Lưu thành Đề Nhỏ
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Hình ảnh */}
              <div>
                <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Hình ảnh bài tập</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
                  <img src={croppedBase64} alt="Bài tập" className="w-full h-auto rounded-lg shadow-sm" />
                </div>
              </div>
              
              {/* Kết quả AI */}
              <div className="space-y-6">
                <div>
                  <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider">Tên bài tập</label>
                  <input
                    type="text"
                    value={aiResult.title}
                    onChange={(e) => setAiResult({ ...aiResult, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold"
                  />
                </div>
                
                <div>
                  <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider">Đề bài (Văn bản)</label>
                  <textarea
                    value={aiResult.questionText}
                    onChange={(e) => setAiResult({ ...aiResult, questionText: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider flex justify-between items-center">
                    <span>Lời giải & Barem (AI sinh)</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">Tổng 10 điểm</span>
                  </label>
                  <textarea
                    value={aiResult.solutionText}
                    onChange={(e) => setAiResult({ ...aiResult, solutionText: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/pages/TextbookBuilder.tsx', fileContent);
