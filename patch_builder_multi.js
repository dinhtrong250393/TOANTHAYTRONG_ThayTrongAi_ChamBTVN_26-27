import fs from 'fs';

const fileContent = `import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { ArrowLeft, Upload, FileImage, Cpu, Loader2, Save, CheckCircle, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TextbookBuilder() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  
  const [step, setStep] = useState<'upload' | 'analyze' | 'review'>('upload');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setTotalToProcess(files.length);
      setCurrentProcessingIndex(0);
      setBatchResults([]);
      setStep('analyze');
      setIsAnalyzing(true);

      const results = [];
      for (let i = 0; i < files.length; i++) {
        setCurrentProcessingIndex(i + 1);
        setUploadProgress(\`Đang xử lý ảnh \${i + 1} / \${files.length}...\`);

        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.addEventListener('load', () => resolve(reader.result?.toString() || ''));
          reader.readAsDataURL(file);
        });

        try {
          setUploadProgress(\`Đang tải ảnh \${i + 1} lên hệ thống...\`);
          const formData = new FormData();
          formData.append('file', base64);
          formData.append('upload_preset', 'KIEM TRA BAI TAP');
          
          const cloudinaryRes = await fetch('https://api.cloudinary.com/v1_1/ao9sncyh/image/upload', {
            method: 'POST',
            body: formData
          });
          
          let imageUrl = '';
          if (cloudinaryRes.ok) {
            const cloudinaryData = await cloudinaryRes.json();
            imageUrl = cloudinaryData.secure_url;
          } else {
            console.warn('Cloudinary upload failed for image', i);
          }

          setUploadProgress(\`AI đang phân tích và giải đề \${i + 1}...\`);
          const aiRes = await fetch('/api/solve-textbook-exercise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 })
          });
          
          if (!aiRes.ok) throw new Error('AI analysis failed');
          const aiData = await aiRes.json();

          results.push({
            id: Date.now().toString() + i,
            ...aiData,
            imageUrl: imageUrl || base64,
            originalBase64: base64,
            error: false
          });
        } catch (err) {
          console.error(\`Error processing file \${i}:\`, err);
          results.push({
            id: Date.now().toString() + i,
            title: \`Bài tập \${i + 1} (Lỗi phân tích)\`,
            questionText: 'Có lỗi xảy ra khi AI phân tích ảnh này.',
            solutionText: '',
            imageUrl: base64,
            originalBase64: base64,
            error: true
          });
        }
      }

      setBatchResults(results);
      setIsAnalyzing(false);
      setStep('review');
    }
  };

  const handleUpdateResult = (index: number, field: string, value: string) => {
    const newResults = [...batchResults];
    newResults[index][field] = value;
    setBatchResults(newResults);
  };

  const handleRemoveResult = (index: number) => {
    const newResults = batchResults.filter((_, i) => i !== index);
    setBatchResults(newResults);
    if (newResults.length === 0) {
      setStep('upload');
    }
  };

  const handleSaveAll = async () => {
    if (!batchResults.length || !lessonId || !appUser) return;
    setIsSaving(true);
    
    try {
      // Fetch lesson to inherit assigned classes and time settings
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

      for (const result of batchResults) {
        const essayData = {
          title: result.title || 'Bài tập SGK',
          assignedClasses,
          teacherId: appUser.uid,
          startTime,
          endTime,
          assignmentImages: [result.imageUrl || result.originalBase64],
          solutionImages: [],
          solutionText: result.solutionText || '',
          questionText: result.questionText || '',
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
               Bạn có thể chọn <strong>nhiều ảnh cùng lúc</strong> (mỗi ảnh tương ứng 1 bài tập/đề nhỏ). Hệ thống sẽ tự động phân tích và giải toàn bộ.
             </p>
             
             <label className="inline-flex items-center justify-center bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
               <Upload className="w-5 h-5 mr-2" />
               Chọn các ảnh tải lên
               <input type="file" accept="image/*" multiple onChange={onSelectFile} className="hidden" />
             </label>
          </div>
        )}

        {step === 'analyze' && (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center">
             <Cpu className="w-16 h-16 text-indigo-500 mx-auto mb-6 animate-pulse" />
             <h2 className="text-2xl font-black text-slate-800 mb-4">AI đang phân tích hàng loạt...</h2>
             <p className="text-slate-600 font-bold mb-2">Đang xử lý: {currentProcessingIndex} / {totalToProcess}</p>
             <p className="text-slate-500 mb-6">{uploadProgress}</p>
             <div className="flex justify-center">
               <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
             </div>
             <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-2.5 mt-6">
               <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: \`\${(currentProcessingIndex / totalToProcess) * 100}%\` }}></div>
             </div>
          </div>
        )}

        {step === 'review' && batchResults.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center sticky top-20 z-40">
              <h2 className="text-xl font-bold text-slate-800 flex items-center mb-4 md:mb-0">
                <CheckCircle className="w-6 h-6 mr-2 text-emerald-500" />
                Kiểm tra & Lưu ({batchResults.length} bài)
              </h2>
              <div className="flex space-x-3 w-full md:w-auto">
                <button
                  onClick={() => {
                    if (window.confirm('Hủy bỏ toàn bộ kết quả hiện tại và chọn lại ảnh?')) {
                      setStep('upload');
                      setBatchResults([]);
                    }
                  }}
                  className="flex-1 md:flex-none bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Hủy
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
              {batchResults.map((result, index) => (
                <div key={result.id} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm relative">
                  
                  <div className="absolute top-4 right-4">
                    <button 
                      onClick={() => handleRemoveResult(index)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Bỏ qua ảnh này"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-indigo-600 mb-6 border-b border-slate-100 pb-4">Đề {index + 1}</h3>

                  {result.error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start text-rose-700">
                      <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Lỗi phân tích AI</p>
                        <p className="text-sm opacity-90">Không thể nhận diện nội dung trong ảnh này. Bạn có thể xóa đi hoặc vẫn lưu lại ảnh làm đề bài.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Hình ảnh */}
                    <div>
                      <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Hình ảnh bài tập</h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
                        <img src={result.originalBase64} alt="Bài tập" className="w-full h-auto rounded-lg shadow-sm" />
                      </div>
                    </div>
                    
                    {/* Kết quả AI */}
                    <div className="space-y-6">
                      <div>
                        <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider">Tên bài tập</label>
                        <input
                          type="text"
                          value={result.title}
                          onChange={(e) => handleUpdateResult(index, 'title', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold"
                        />
                      </div>
                      
                      <div>
                        <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider">Đề bài (Văn bản)</label>
                        <textarea
                          value={result.questionText}
                          onChange={(e) => handleUpdateResult(index, 'questionText', e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 mb-2 block text-sm uppercase tracking-wider flex justify-between items-center">
                          <span>Lời giải & Barem</span>
                        </label>
                        <textarea
                          value={result.solutionText}
                          onChange={(e) => handleUpdateResult(index, 'solutionText', e.target.value)}
                          rows={8}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Bottom save button for convenience if list is long */}
            {batchResults.length > 2 && (
              <div className="flex justify-end pt-4 pb-8">
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold flex items-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Lưu Tất Cả {batchResults.length} Bài Tập
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
\`;

fs.writeFileSync('src/pages/TextbookBuilder.tsx', fileContent);
