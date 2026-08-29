import fs from 'fs';

const fileContent = `import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { ArrowLeft, Upload, FileImage, Cpu, Loader2, Save, CheckCircle, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';

type BatchItem = {
  id: string;
  originalBase64: string;
  title: string;
  questionText: string;
  solutionText: string;
  imageUrl: string;
  isAnalyzing: boolean;
};

export default function TextbookBuilder() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const onSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const items: BatchItem[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.addEventListener('load', () => resolve(reader.result?.toString() || ''));
          reader.readAsDataURL(file);
        });
        
        items.push({
          id: Date.now().toString() + i,
          originalBase64: base64,
          title: \`Bài tập \${i + 1}\`,
          questionText: '',
          solutionText: '',
          imageUrl: '',
          isAnalyzing: false
        });
      }

      setBatchItems(items);
      setStep('review');
    }
  };

  const updateItem = (index: number, updates: Partial<BatchItem>) => {
    setBatchItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleGenerateBarem = async (index: number) => {
    const item = batchItems[index];
    if (!item.originalBase64) return;
    
    updateItem(index, { isAnalyzing: true });
    
    try {
      // 1. Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', item.originalBase64);
      formData.append('upload_preset', 'KIEM TRA BAI TAP');
      
      const cloudinaryRes = await fetch('https://api.cloudinary.com/v1_1/ao9sncyh/image/upload', {
        method: 'POST',
        body: formData
      });
      
      let imageUrl = '';
      if (cloudinaryRes.ok) {
        const cloudinaryData = await cloudinaryRes.json();
        imageUrl = cloudinaryData.secure_url;
      }
      
      // 2. AI analyze
      const aiRes = await fetch('/api/solve-textbook-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: item.originalBase64 })
      });
      
      if (!aiRes.ok) throw new Error('AI failed');
      const aiData = await aiRes.json();
      
      updateItem(index, {
        title: aiData.title || item.title,
        questionText: aiData.questionText || '',
        solutionText: aiData.solutionText || '',
        imageUrl: imageUrl || item.originalBase64,
        isAnalyzing: false
      });
      
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi tạo Barem bằng AI.');
      updateItem(index, { isAnalyzing: false });
    }
  };

  const handleRemoveResult = (index: number) => {
    const newResults = batchItems.filter((_, i) => i !== index);
    setBatchItems(newResults);
    if (newResults.length === 0) {
      setStep('upload');
    }
  };

  const handleSaveAll = async () => {
    if (!batchItems.length || !lessonId || !appUser) return;
    setIsSaving(true);
    
    try {
      const lessonDoc = await getDoc(doc(db, 'textbook_lessons', lessonId));
      let assignedClasses: any[] = [];
      let startTime = '';
      let endTime = '';
      if (lessonDoc.exists()) {
        const data = lessonDoc.data();
        assignedClasses = data.assignedClasses || [];
        startTime = data.startTime || '';
        endTime = data.endTime || '';
      }

      const { saveEssayMetadata, syncClassSummary } = await import("../lib/syncUtils");
      const { syncEssayResultsCover, syncEssaysCover } = await import("../lib/firebase");

      let successCount = 0;

      for (const item of batchItems) {
        const essayData = {
          title: item.title || 'Bài tập SGK',
          assignedClasses,
          teacherId: appUser.uid,
          startTime,
          endTime,
          assignmentImages: [item.imageUrl || item.originalBase64],
          solutionImages: [],
          solutionText: item.solutionText || '',
          questionText: item.questionText || '',
          type: 'essay',
          textbookLessonId: lessonId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const docRef = await addDoc(collection(db, "essays"), essayData);
        await saveEssayMetadata(docRef.id, essayData);
        if (syncEssayResultsCover) await syncEssayResultsCover(docRef.id);
        successCount++;
      }
      
      if (assignedClasses && assignedClasses.length > 0) {
        for (const className of assignedClasses) {
          await syncClassSummary(className);
        }
      }
      await syncEssaysCover(appUser.uid);
      
      alert(\`Đã lưu thành công \${successCount} bài tập!\`);
      navigate('/teacher');
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
      
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        
        {step === 'upload' && (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center">
             <FileImage className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
             <h2 className="text-2xl font-black text-slate-800 mb-4">Tải lên ảnh bài tập</h2>
             <p className="text-slate-500 mb-8 max-w-md mx-auto">
               Bạn có thể chọn <strong>nhiều hình ảnh cùng lúc</strong>. Mỗi hình ảnh sẽ tạo thành 1 đề nhỏ riêng biệt trong danh sách.
             </p>
             
             <label className="inline-flex items-center justify-center bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
               <Upload className="w-5 h-5 mr-2" />
               Chọn các ảnh tải lên
               <input type="file" accept="image/*" multiple onChange={onSelectFiles} className="hidden" />
             </label>
          </div>
        )}

        {step === 'review' && batchItems.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center sticky top-20 z-40">
              <h2 className="text-xl font-bold text-slate-800 flex items-center mb-4 md:mb-0">
                <CheckCircle className="w-6 h-6 mr-2 text-emerald-500" />
                Danh sách Đề (\${batchItems.length})
              </h2>
              <div className="flex space-x-3 w-full md:w-auto">
                <button
                  onClick={() => {
                    if (window.confirm('Hủy bỏ toàn bộ danh sách hiện tại và chọn lại ảnh?')) {
                      setStep('upload');
                      setBatchItems([]);
                    }
                  }}
                  className="flex-1 md:flex-none bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Hủy / Chọn lại
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="flex-1 md:flex-none bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Lưu Tất Cả
                </button>
              </div>
            </div>
            
            <div className="space-y-8">
              {batchItems.map((item, index) => (
                <div key={item.id} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm relative">
                  
                  <div className="absolute top-4 right-4">
                    <button 
                      onClick={() => handleRemoveResult(index)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Xóa đề này"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-indigo-600 mb-6 border-b border-slate-100 pb-4">
                    \${item.title || \`Bài tập \${index + 1}\`}
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Hình ảnh */}
                    <div>
                      <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Hình ảnh bài tập</h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
                        <img src={item.originalBase64} alt="Bài tập" className="w-full h-auto rounded-lg shadow-sm" />
                      </div>
                    </div>
                    
                    {/* Kết quả / Nội dung */}
                    <div className="space-y-6">
                      
                      {!item.solutionText && !item.isAnalyzing && (
                         <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
                            <Cpu className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
                            <h4 className="font-bold text-indigo-800 mb-2">Chưa có lời giải & barem</h4>
                            <p className="text-sm text-indigo-600 mb-4">Bạn có thể tự nhập tay hoặc dùng AI để sinh tự động từ ảnh.</p>
                            <button
                              onClick={() => handleGenerateBarem(index)}
                              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold inline-flex items-center hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                              <Wand2 className="w-4 h-4 mr-2" />
                              Tạo Barem Bằng AI
                            </button>
                         </div>
                      )}

                      {item.isAnalyzing && (
                         <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[200px]">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                            <p className="font-bold text-slate-700">AI đang phân tích ảnh này...</p>
                         </div>
                      )}

                      {(item.solutionText || (!item.solutionText && !item.isAnalyzing)) && (
                        <>
                          <div>
                            <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider">Tên bài tập</label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => updateItem(index, { title: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold"
                              placeholder="VD: Bài tập 1"
                            />
                          </div>
                          
                          <div>
                            <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider">Đề bài (Văn bản)</label>
                            <textarea
                              value={item.questionText}
                              onChange={(e) => updateItem(index, { questionText: e.target.value })}
                              rows={3}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none"
                              placeholder="Nhập nội dung đề bài (hoặc để AI tự điền)"
                            />
                          </div>

                          <div>
                            <label className="font-bold text-slate-700 mb-2 flex justify-between items-center text-sm uppercase tracking-wider">
                              <span>Barem Chấm (Lời giải)</span>
                              {item.solutionText && (
                                <button onClick={() => handleGenerateBarem(index)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center bg-indigo-50 px-2 py-1 rounded-md">
                                  <RefreshCw className="w-3 h-3 mr-1" /> Tạo lại bằng AI
                                </button>
                              )}
                            </label>
                            <textarea
                              value={item.solutionText}
                              onChange={(e) => updateItem(index, { solutionText: e.target.value })}
                              rows={6}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-mono text-sm"
                              placeholder="Nhập barem chấm (hoặc để AI tự tạo)"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {batchItems.length > 2 && (
              <div className="flex justify-end pt-4 pb-8">
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold flex items-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Lưu Tất Cả \${batchItems.length} Bài Tập
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/pages/TextbookBuilder.tsx', fileContent);
