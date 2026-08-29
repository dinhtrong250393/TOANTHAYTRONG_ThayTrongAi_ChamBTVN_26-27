import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, syncEssayResultsCover, uploadBase64ToStorage } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, arrayUnion, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { 
  ArrowLeft, 
  Loader2, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Send, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Sparkles, 
  Award, 
  BookOpen, 
  ChevronRight, 
  Layers, 
  Eye,
  Calendar,
  Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

// CSS Mockups designed to look exactly like Google AI Studio, solving broken image issues.
const Step1Mockup = () => (
  <div className="w-full aspect-[4/3] bg-slate-50 rounded-xl border border-slate-200 shadow-md flex flex-col overflow-hidden text-left font-sans select-none relative">
    {/* Browser Tab Bar */}
    <div className="bg-slate-100 px-2 py-1 flex items-center space-x-1 border-b border-slate-200 shrink-0">
      <div className="flex space-x-1">
        <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
        <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
      </div>
      <div className="flex-1 flex space-x-1 pl-3">
        <div className="bg-white px-2 py-0.5 rounded-t text-[8px] text-slate-700 font-medium border-t border-x border-slate-200 flex items-center space-x-1 max-w-[110px] truncate shadow-sm">
          <span className="text-blue-500 text-[6px]">⚡</span>
          <span>API keys | Google AI...</span>
        </div>
        <div className="px-2 py-0.5 rounded-t text-[8px] text-slate-400 flex items-center space-x-1 max-w-[110px] truncate">
          <span>🌐 TOÁN THẦY TRỌNG 3T</span>
        </div>
      </div>
    </div>
    {/* Address Bar */}
    <div className="bg-white px-2 py-0.5 flex items-center border-b border-slate-200 shrink-0">
      <div className="flex-1 bg-slate-100 rounded px-2 py-0.5 text-[8px] text-slate-500 truncate font-mono">
        https://aistudio.google.com/app/api-keys?project=seismic-honor-492901-g3
      </div>
    </div>
    {/* Web Page Workspace */}
    <div className="flex-1 bg-white p-3 flex flex-col justify-between overflow-hidden">
      {/* Sidebar button & Content Header */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1 border border-slate-200 rounded bg-slate-50 text-slate-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </div>
          <h1 className="text-xs font-extrabold text-slate-800 tracking-tight">API keys</h1>
        </div>
        
        {/* Buttons on the right */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[7px] text-slate-500 flex items-center space-x-0.5 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
            <span>📄</span>
            <span>API Quick Start Guide</span>
          </span>
          
          {/* Circled "Create an API key" button */}
          <div className="relative p-0.5 shrink-0">
            <button className="bg-white hover:bg-slate-50 text-slate-700 text-[7.5px] font-bold px-2 py-1 border border-slate-300 rounded flex items-center space-x-1 shadow-sm">
              <span>🔑</span>
              <span>Create an API key</span>
            </button>
            {/* Red highlight circle matching the user's screenshot */}
            <div className="absolute inset-0 border-2 border-red-500 rounded pointer-events-none opacity-90 animate-pulse" style={{ transform: 'scale(1.2) rotate(-2deg)' }}></div>
          </div>
        </div>
      </div>

      {/* Sub controls */}
      <div className="mt-2 flex justify-between items-center text-[7px] text-slate-500 shrink-0">
        <div className="flex items-center space-x-1">
          <span>Group by</span>
          <button className="bg-slate-100 text-slate-800 border border-slate-300 px-1.5 py-0.5 rounded-l font-medium">● API key</button>
          <button className="bg-white text-slate-500 border border-l-0 border-slate-300 px-1.5 py-0.5 rounded-r">Project</button>
        </div>
        <div className="flex items-center space-x-0.5 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">
          <span>Filter by</span>
          <span className="font-semibold text-slate-700">All projects</span>
          <span>▼</span>
        </div>
      </div>
      
      {/* Decorative Bottom Table */}
      <div className="mt-2 flex-1 border border-slate-100 rounded p-2 bg-slate-50/50 flex flex-col justify-center items-center text-center">
        <span className="text-[8px] text-slate-400">Danh sách các API Key hiện có sẽ hiển thị ở đây...</span>
      </div>
    </div>
  </div>
);

const Step2Mockup = () => (
  <div className="w-full aspect-[4/3] bg-slate-100 rounded-xl border border-slate-200 shadow-md flex flex-col overflow-hidden text-left font-sans select-none relative">
    {/* Background simulated dialog backdrop */}
    <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center p-3">
      {/* Modal Dialog */}
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-[240px] p-3 space-y-2.5">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-1 shrink-0">
          <h2 className="text-[10px] font-bold text-slate-800">Create a key</h2>
          <span className="text-slate-400 text-[9px] cursor-pointer">✕</span>
        </div>
        
        {/* Fields */}
        <div className="space-y-2">
          <div className="space-y-0.5">
            <label className="block text-[7px] font-medium text-slate-500 uppercase tracking-wider">Give your key a name</label>
            <input 
              type="text" 
              readOnly 
              value="Gemini API Key 7" 
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[8px] text-slate-700 outline-none"
            />
          </div>
          
          <div className="space-y-0.5">
            <label className="block text-[7px] font-medium text-slate-500 uppercase tracking-wider">Choose an imported project</label>
            <div className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[8px] text-slate-700 flex justify-between items-center cursor-pointer">
              <span>My Project 93316</span>
              <span className="text-[7px] text-slate-400">▼</span>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end items-center space-x-2 pt-1 shrink-0">
          <button className="text-[8px] font-bold text-slate-600 hover:text-slate-800">Cancel</button>
          
          {/* Circled "Create a key" button */}
          <div className="relative p-0.5 shrink-0">
            <button className="bg-slate-100 text-slate-700 text-[8px] font-extrabold px-2 py-1 rounded border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-200">
              Create a key
            </button>
            {/* Red highlight circle matching the user's screenshot */}
            <div className="absolute inset-0 border-2 border-red-500 rounded-full pointer-events-none opacity-90 animate-pulse" style={{ transform: 'scale(1.2) rotate(3deg)' }}></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Step3Mockup = () => (
  <div className="w-full aspect-[4/3] bg-slate-100 rounded-xl border border-slate-200 shadow-md flex flex-col overflow-hidden text-left font-sans select-none relative">
    {/* Background simulated dialog backdrop */}
    <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center p-3">
      {/* Modal Dialog */}
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-[240px] p-2.5 space-y-2">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-1 shrink-0">
          <h2 className="text-[10px] font-bold text-slate-800">API key details</h2>
          <span className="text-slate-400 text-[9px] cursor-pointer">✕</span>
        </div>
        
        {/* Blue Info Box */}
        <div className="bg-blue-50/70 border border-blue-100 rounded p-1.5 flex items-start space-x-1 shrink-0">
          <span className="text-blue-500 text-[9px] mt-0.5 leading-none">ⓘ</span>
          <p className="text-[6.5px] text-slate-600 leading-normal font-normal">
            To learn more about using authentication keys with the Gemini API, see the <span className="text-blue-600 underline font-semibold cursor-pointer">API key documentation</span>.
          </p>
        </div>

        {/* Info Rows */}
        <div className="space-y-1.5 text-[7px] max-h-[85px] overflow-hidden">
          {/* API Key Field */}
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-1.5">
              <span className="block text-slate-500 font-medium">API key</span>
              <span className="block font-mono text-slate-800 break-all font-semibold text-[6.5px] bg-slate-50 p-1 rounded border border-slate-100 truncate">
                YOUR_API_KEY_HERE...
              </span>
            </div>
            
            {/* Red highlight circled copy button */}
            <div className="relative mt-2.5 p-0.5 shrink-0">
              <button className="p-0.5 hover:bg-slate-100 rounded border border-slate-200 text-slate-500 bg-white">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4l3 3v4a2 2 0 01-2 2h-1M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </button>
              {/* Red highlight circle matching the user's screenshot */}
              <div className="absolute inset-0 border-2 border-red-500 rounded pointer-events-none opacity-90 animate-pulse" style={{ transform: 'scale(1.2) rotate(-5deg)' }}></div>
            </div>
          </div>

          {/* Name Field */}
          <div className="flex justify-between items-center border-t border-slate-100 pt-0.5">
            <div>
              <span className="block text-slate-500 font-medium leading-none">Name</span>
              <span className="block font-semibold text-slate-800 leading-normal">Gemini API Key 7</span>
            </div>
            <button className="p-0.5 text-slate-400">
              <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4l3 3v4a2 2 0 01-2 2h-1M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 text-[6.5px] font-bold shrink-0">
          <span className="text-red-500 hover:underline cursor-pointer">Delete the key</span>
          <button className="bg-white hover:bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 shadow-sm">
            Copy the key
          </button>
        </div>
      </div>
    </div>
  </div>
);

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

const parseMarkdownAndMath = (text: string) => {
  if (!text) return { processedText: '', mathBlocks: [] as string[] };
  
  const mathBlocks: string[] = [];
  
  // 1. Extract block math $$ ... $$
  let processedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const placeholder = `__BLOCK_MATH_${mathBlocks.length}__`;
    mathBlocks.push(`$$${formula}$$`);
    return placeholder;
  });
  
  // 2. Extract \[ ... \]
  processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
    const placeholder = `__BLOCK_MATH_${mathBlocks.length}__`;
    mathBlocks.push(`$$${formula}$$`);
    return placeholder;
  });

  // 3. Extract inline math $ ... $
  processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
    const placeholder = `__INLINE_MATH_${mathBlocks.length}__`;
    mathBlocks.push(`$${formula}$`);
    return placeholder;
  });
  
  // 4. Extract \( ... \)
  processedText = processedText.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => {
    const placeholder = `__INLINE_MATH_${mathBlocks.length}__`;
    mathBlocks.push(`$${formula}$`);
    return placeholder;
  });

  return { processedText, mathBlocks };
};

const renderTextWithMath = (text: string, mathBlocks: string[]): React.ReactNode => {
  if (!text) return '';
  
  const regex = /__(BLOCK|INLINE)_MATH_(\d+)__/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const index = match.index;
    const blockIdx = parseInt(match[2], 10);
    
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }
    
    const mathContent = mathBlocks[blockIdx];
    if (mathContent) {
      parts.push(<Latex key={`math-${blockIdx}`}>{mathContent}</Latex>);
    }
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? <React.Fragment>{parts}</React.Fragment> : text;
};

const createMathRenderer = (mathBlocks: string[]) => {
  const renderer = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      return renderTextWithMath(children, mathBlocks);
    }
    if (Array.isArray(children)) {
      return children.map((child, idx) => (
        <React.Fragment key={idx}>{renderer(child)}</React.Fragment>
      ));
    }
    return children;
  };
  return renderer;
};

export default function TakeEssay() {
  const { essayId } = useParams<{ essayId: string }>();
  const { appUser, refreshAppUser } = useAuth();
  const navigate = useNavigate();
  
  const [essay, setEssay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // For page load errors
  const [submitError, setSubmitError] = useState<string | null>(null); // For local submit/grading errors
  
  const [images, setImages] = useState<string[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('Đang nộp bài...');
  const [activeTab, setActiveTab] = useState<'ai' | 'submission' | 'solution'>('ai');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [studentApiKey, setStudentApiKey] = useState<string>(() => {
    return localStorage.getItem('student_gemini_api_key') || '';
  });

  const [isGrading, setIsGrading] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  const handleApiKeyChange = (val: string) => {
    setStudentApiKey(val);
    localStorage.setItem('student_gemini_api_key', val);
  };

  const triggerGrading = async (subId: string, apiKey: string) => {
    if (!subId || !essay) return;
    setIsGrading(true);
    setGradingError(null);
    console.log('[TakeEssay] Triggering direct grading for submission:', subId);
    try {
      const subRef = doc(db, 'essay_submissions', subId);
      await updateDoc(subRef, {
        status: 'grading_in_progress',
        studentApiKey: apiKey,
        errorMsg: null
      });

      // Lấy thông tin bài nộp đầy đủ từ Firestore
      const subSnap = await getDoc(subRef);
      if (!subSnap.exists()) {
        throw new Error('Không tìm thấy bài làm để chấm lại.');
      }
      const submissionData = subSnap.data();

      const response = await fetch('/api/grade-essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submission: { id: subId, ...submissionData },
          essay,
          studentApiKey: apiKey || studentApiKey
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Lỗi chấm bài từ máy chủ.');
      }

      const result = await response.json();
      const aiFeedback = result.aiFeedback;
      const score = result.score;

      // Lưu kết quả chấm điểm vào Firestore
      await updateDoc(subRef, {
        status: 'graded',
        score,
        aiFeedback,
        errorMsg: null
      });

      // Cập nhật điểm số trong hồ sơ học sinh
      const userRef = doc(db, 'users', appUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const completedEssays = userData.completedEssays || [];
        const index = completedEssays.findIndex((c: any) => c.essayId === essay.id);
        if (index !== -1) {
          completedEssays[index] = {
            ...completedEssays[index],
            score,
            status: 'graded'
          };
          await updateDoc(userRef, { completedEssays });
        }
      }

      setSubmission({
        id: subId,
        ...submissionData,
        status: 'graded',
        score,
        aiFeedback
      });
    } catch (err: any) {
      console.error('[TakeEssay] Triggering grading failed:', err);
      setGradingError(err.message || 'Lỗi không thể gửi yêu cầu chấm bài.');
      const subRef = doc(db, 'essay_submissions', subId);
      await updateDoc(subRef, {
        status: 'grading_failed',
        errorMsg: err.message || 'Lỗi chấm bài từ máy chủ.'
      });
    } finally {
      setIsGrading(false);
    }
  };

  useEffect(() => {
    const fetchEssayAndSubmission = async () => {
      if (!essayId || !appUser) return;
      try {
        let data = null;
        let id = essayId;

        const cachedEssay = sessionStorage.getItem('cached_essay_' + essayId);
        if (cachedEssay) {
          try {
            data = JSON.parse(cachedEssay);
          } catch (e) {
            sessionStorage.removeItem('cached_essay_' + essayId);
          }
        }

        if (!data) {
          const docRef = doc(db, 'essays', essayId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            data = docSnap.data();
          } else {
            const coverDoc = await getDoc(doc(db, 'essay_results_cover', essayId));
            if (coverDoc.exists()) {
              data = coverDoc.data();
            }
          }
          if (data) {
            try {
              sessionStorage.setItem('cached_essay_' + essayId, JSON.stringify(data));
            } catch (e) {}
          }
        }

        if (!data) {
          throw new Error('Không tìm thấy bài tập tự luận');
        }
        
        // Validate if user can take it
        if (data.startTime && new Date(data.startTime) > new Date()) {
          throw new Error('Bài tập tự luận này chưa đến giờ mở');
        }
        if (!data.assignedClasses?.includes(appUser.className)) {
          throw new Error('Bạn không thuộc lớp được giao bài tập này');
        }

        setEssay({ id: essayId, ...data });

        // Check for existing submission using Point-read (O(1)) instead of Array Scanning (O(N))
        const existingSubmissionMeta = (appUser as any).completedEssays?.find((c: any) => c.essayId === essayId);
        let foundSubmission = false;
        
        if (existingSubmissionMeta && existingSubmissionMeta.submissionId) {
          const subSnap = await getDoc(doc(db, 'essay_submissions', existingSubmissionMeta.submissionId));
          if (subSnap.exists()) {
            setSubmission({ id: subSnap.id, ...subSnap.data() });
            foundSubmission = true;
          }
        }

        if (!foundSubmission) {
          // If no submission and assignment is expired, block entry
          if (data.endTime && new Date(data.endTime) < new Date()) {
            throw new Error('Bài tập tự luận này đã hết hạn và đóng nộp bài.');
          }

          // Cleanup dangling reference
          const hasDangling = (appUser as any).completedEssays?.some((c: any) => c.essayId === essayId);
          if (hasDangling) {
            const userRef = doc(db, 'users', appUser.uid);
            const newCompleted = ((appUser as any).completedEssays || []).filter((c: any) => c.essayId !== essayId);
            await updateDoc(userRef, { completedEssays: newCompleted });
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEssayAndSubmission();
  }, [essayId, appUser]);

  // Listen for real-time updates to the submission ONLY when it is actively being graded or submitted
  useEffect(() => {
    if (!submission?.id) return;
    if (submission.status !== 'grading_in_progress' && submission.status !== 'submitted') return;
    
    console.log('[TakeEssay] Subscribing to active submission updates for ID:', submission.id);
    const subRef = doc(db, 'essay_submissions', submission.id);
    const unsubscribe = onSnapshot(subRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedData = { id: snapshot.id, ...snapshot.data() };
        setSubmission(updatedData);
      }
    });

    return () => unsubscribe();
  }, [submission?.id, submission?.status]);

  // Save images draft to localStorage to prevent losing uploaded work on refresh
  useEffect(() => {
    if (!essayId || !essay) return;
    const handler = setTimeout(() => {
      if (images.length > 0) {
        try {
          localStorage.setItem(`draft_essay_images_${essayId}`, JSON.stringify(images));
        } catch (e) {
          console.warn("Could not save essay images draft:", e);
        }
      } else {
        localStorage.removeItem(`draft_essay_images_${essayId}`);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [images, essayId, essay]);

  // Load draft images on mount/essay load
  useEffect(() => {
    if (!essayId || !essay) return;
    const savedImages = localStorage.getItem(`draft_essay_images_${essayId}`);
    if (savedImages) {
      try {
        setImages(JSON.parse(savedImages));
      } catch (e) {
        console.error("Error parsing saved essay images draft", e);
      }
    }
  }, [essayId, essay]);



  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Optimal width for clear math formulas and fast API responses
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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Smart compression: 0.6 balance of clarity & size
            
            // Calculate size reduction ratio
            const originalKb = (file.size / 1024).toFixed(1);
            const compressedKb = (dataUrl.length * 0.75 / 1024).toFixed(1);
            console.log(`[Smart Compression] File: ${file.name}, Original: ${originalKb} KB, Compressed: ${compressedKb} KB (Ratio: ${((Number(compressedKb) / Number(originalKb)) * 100).toFixed(1)}%)`);
            
            resolve(dataUrl);
          } else {
            reject(new Error('Failed to create 2D canvas context'));
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    
    setSubmitError(null);
    const validFiles = Array.from(filesList).filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setSubmitError('Vui lòng chỉ tải lên định dạng hình ảnh (PNG, JPG, JPEG).');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitMessage('Đang xử lý ảnh...');
      const base64Images = await Promise.all(validFiles.map(file => processImage(file)));
      
      // Store the compressed base64 images directly in state
      setImages(prev => [...prev, ...base64Images]);
    } catch (err: any) {
      console.error("Lỗi xử lý ảnh:", err);
      setSubmitError('Lỗi đọc ảnh: ' + err.message);
    } finally {
      setIsSubmitting(false);
      setSubmitMessage('Đang nộp bài...');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleImageUpload(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!essay || !appUser) return;
    if (essay.endTime && new Date(essay.endTime) < new Date()) {
      setSubmitError('Bài tập tự luận này đã hết hạn, không thể nộp bài.');
      return;
    }
    if (images.length === 0) {
      setSubmitError('Vui lòng tải lên ít nhất một hình ảnh bài viết.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage('Đang chuẩn bị gửi bài giải...');
    try {
      setSubmitMessage('Đang xử lý hình ảnh bài làm...');
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.startsWith('data:')) {
          if (i > 0) {
            // [Thuật toán Nhỏ giọt]: Đợi 0.5 giây để giải phóng RAM cho điện thoại Android yếu (Cloudinary không bị nghẽn như ImgBB)
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          const path = `essay_submissions/${appUser.uid}_${Date.now()}_${i}.jpg`;
          const url = await uploadBase64ToStorage(img, path);
          uploadedImageUrls.push(url);
        } else {
          uploadedImageUrls.push(img);
        }
      }

      setSubmitMessage('Đang lưu bài làm lên hệ thống...');

      const submissionData = {
        essayId: essay.id,
        essayTitle: essay.title,
        studentId: appUser.uid,
        studentName: appUser.name,
        studentClass: appUser.className,
        studentZalo: appUser.zalo || null,
        studentFacebook: appUser.facebook || null,
        images: uploadedImageUrls,
        text: "", // Chấm trực tiếp bằng Multimodal không qua OCR trung gian
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        score: null,
        aiFeedback: null,
        studentApiKey,
        errorMsg: null
      };

      const docRef = doc(collection(db, "essay_submissions"));
      await setDoc(docRef, submissionData);

      const userRef = doc(db, 'users', appUser.uid);
      await updateDoc(userRef, { completedEssays: arrayUnion({ essayId: essay.id, submissionId: docRef.id, score: null, status: 'submitted', submittedAt: submissionData.submittedAt }) }).catch(e => console.warn("user essays update failed:", e));

      // Update essay de-normalized submissionSummary
      const essayRef = doc(db, 'essays', essay.id);
      const summaryItem = {
        id: docRef.id,
        studentId: appUser.uid,
        studentName: appUser.name,
        studentClass: appUser.className || '',
        studentZalo: appUser.zalo || null,
        studentFacebook: appUser.facebook || null,
        submittedAt: submissionData.submittedAt,
        status: 'submitted',
        score: null
      };
      await setDoc(essayRef, { submissionSummary: arrayUnion(summaryItem) }, { merge: true }).catch(e => console.warn("essays cover update failed:", e));

      const essayMetaRef = doc(db, 'essays_metadata', essay.id);
      await setDoc(essayMetaRef, { submissionSummary: arrayUnion(summaryItem) }, { merge: true }).catch(e => console.warn("essays_metadata update failed:", e));

      // Write submission summary directly to the inner cover sheet for results (essay_results_cover)
      // This is a pure Write operation (0 Reads) and avoids the getDoc inside syncEssayResultsCover!
      const coverRef = doc(db, 'essay_results_cover', essay.id);
      await setDoc(coverRef, {
        submissionSummary: arrayUnion(summaryItem)
      }, { merge: true }).catch(e => console.warn("essay_results_cover update failed:", e));

      setSubmission({ id: docRef.id, ...submissionData });
      try {
        localStorage.removeItem(`draft_essay_images_${essay.id}`);
      } catch (e) {}
      await refreshAppUser();
      setIsSubmitting(false);
    } catch (err: any) {
      console.error("Lỗi nộp bài tự luận:", err);
      setSubmitError(err.message || 'Lỗi hệ thống. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-14 h-14 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Đang chuẩn bị đề bài tự luận...</p>
      </div>
    );
  }

  // Page load / Access authorization errors
  if (error || !essay) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Không thể tải bài tập</h3>
          <p className="text-slate-500 mb-6 leading-relaxed">{error || 'Đã có lỗi xảy ra khi truy xuất bài tập.'}</p>
          <button 
            onClick={() => navigate('/student')} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200"
          >
            Quay lại Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Pre-process AI Feedback and Reference Solution for math rendering
  const { processedText: processedAiFeedback, mathBlocks: aiFeedbackMathBlocks } = parseMarkdownAndMath(submission?.aiFeedback || '');
  const renderAiFeedbackMath = createMathRenderer(aiFeedbackMathBlocks);

  const { processedText: processedSolutionText, mathBlocks: solutionMathBlocks } = parseMarkdownAndMath(essay?.solutionText || '');
  const renderSolutionMath = createMathRenderer(solutionMathBlocks);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20 gap-4">
            <div className="flex items-center min-w-0 space-x-3 md:space-x-4">
              <button 
                onClick={() => navigate('/student')} 
                className="p-2.5 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all shrink-0"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-[0.2em] font-sans block mb-0.5">BÀI TẬP TỰ LUẬN</span>
                <h1 className="text-base md:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate" title={essay.title}>
                  {essay.title}
                </h1>
              </div>
            </div>
            
            <div className="shrink-0 flex items-center">
              <span className="text-xs md:text-sm bg-indigo-50 text-indigo-700 border border-indigo-100/80 px-3.5 py-1.5 md:py-2 rounded-full font-bold shadow-sm">
                Lớp {appUser?.className}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* COMPLETED SUCCESS RESULT SCREEN */}
      {submission ? (
        submission.status === 'submitted' ? (
          <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-teal-800 to-emerald-800 p-8 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="relative z-10 space-y-4">
                  <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                    <CheckCircle className="w-12 h-12" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">Nộp bài thành công!</h2>
                  
                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 max-w-xl mx-auto mt-4 shadow-inner">
                    <p className="text-emerald-50 font-bold leading-relaxed text-base md:text-lg">
                      Thầy Trọng AI đã nhận được bài và sẽ chấm bài. Vui lòng trở lại sau khi có điểm.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 md:p-8 space-y-6">
                {submission.images && submission.images.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 mr-2 text-indigo-500" /> Hình ảnh bài làm đã nộp ({submission.images.length} ảnh):
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 justify-center">
                      {submission.images.map((img: string, idx: number) => (
                        <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-0.5 shadow-sm">
                          <img src={img} referrerPolicy="no-referrer" className="w-full h-full object-contain rounded-lg" alt={`Đã nộp ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={() => navigate('/student')} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors">
                Quay lại Student Dashboard
              </button>
            </div>
          </div>
        ) : (submission.status === 'grading' || submission.status === 'grading_in_progress') ? (
          <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-indigo-900 to-indigo-850 p-8 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="relative z-10 space-y-4">
                  <div className="w-20 h-20 bg-indigo-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30 animate-pulse">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">Thầy Trọng AI đang chấm bài...</h2>
                  
                  <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 max-w-xl mx-auto mt-4 shadow-inner">
                    <p className="text-indigo-100 font-medium leading-relaxed text-sm md:text-base">
                      Thầy Trọng AI đang xử lý bài của em. Tiến trình sẽ được cập nhật tự động trong thời gian thực.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 md:p-8 space-y-6">
                <div className="max-w-md mx-auto">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 text-center">Tiến trình chấm bài</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 bg-emerald-50 text-emerald-800 px-4 py-3 rounded-xl border border-emerald-100">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="text-xs md:text-sm font-bold">1. Đã nộp bài giải lên hệ thống</span>
                    </div>
                    <div className="flex items-center space-x-3 bg-indigo-50 text-indigo-800 px-4 py-3 rounded-xl border border-indigo-100">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="text-xs md:text-sm font-bold">2. Đã truyền dữ liệu bài làm thành công</span>
                    </div>
                    <div className="flex items-center space-x-3 bg-indigo-50 text-indigo-800 px-4 py-3 rounded-xl border border-indigo-100">
                      <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
                      <span className="text-xs md:text-sm font-bold">3. Thầy Trọng AI đang phân tích & chấm điểm trực tiếp từ hình ảnh...</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 mt-6 max-w-xl mx-auto space-y-4">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 font-medium">Hệ thống đang xử lý chấm điểm bằng Cloud Functions & API Keys xoay vòng tự động.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={() => navigate('/student')} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors">
                Quay lại Student Dashboard
              </button>
            </div>
          </div>
        ) : submission.status === 'key_error' || submission.status === 'grading_failed' ? (
          <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-rose-900 to-rose-800 p-8 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="relative z-10 space-y-4">
                  <div className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <AlertCircle className="w-8 h-8 text-rose-300" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">Chấm điểm gặp sự cố</h2>
                  <p className="text-rose-100 max-w-md mx-auto text-sm font-medium">
                    {submission.errorMsg || 'Không thể kết nối đến máy chủ AI để chấm điểm.'}
                  </p>
                </div>
              </div>
              
              <div className="p-6 md:p-8 space-y-6 max-w-xl mx-auto text-center">
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Đừng lo lắng! Bài làm của em đã được nộp và lưu trữ an toàn trên hệ thống. Giáo viên có thể xem trực tiếp hoặc em có thể thử gửi yêu cầu chấm lại bằng hệ thống tự động bên dưới.
                </p>

                <div className="flex justify-center pt-2">
                  <button 
                    onClick={() => {
                      triggerGrading(submission.id, '');
                    }}
                    disabled={isGrading}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-100 hover:shadow-indigo-200"
                  >
                    {isGrading ? 'Đang gửi yêu cầu chấm lại...' : 'Thử chấm lại'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button onClick={() => navigate('/student')} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors">
                Quay lại Student Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in zoom-in duration-500">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-indigo-800 p-8 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
                
                <div className="relative z-10 space-y-4">
                  <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 transform hover:scale-105 transition-transform duration-300">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">Nộp & Chấm điểm thành công!</h2>
                  <p className="text-indigo-200 max-w-lg mx-auto font-medium">
                    Bài làm của em đã được chấm. Hãy xem điểm và nhận xét chi tiết bên dưới.
                  </p>
                  
                  {/* Score Section */}
                  <div className="inline-block bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-md border border-white/20 rounded-3xl py-8 px-12 shadow-2xl mt-6 transform hover:scale-105 transition-transform duration-500">
                    <div className="text-xs font-black text-indigo-200 uppercase tracking-[0.2em] mb-2 font-mono opacity-90">Kết quả điểm số</div>
                    <div className="text-7xl font-black text-emerald-400 drop-shadow-lg font-mono flex items-baseline justify-center tracking-tighter">
                      {submission.score?.toFixed(1) || '0.0'}
                      <span className="text-3xl text-emerald-100/50 font-bold ml-2">/10</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content & Tab Panel */}
              <div className="p-6 md:p-8">
                <div className="flex border-b border-slate-200 mb-6 overflow-x-auto space-x-6 pb-px scrollbar-thin">
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`pb-4 text-sm font-bold flex items-center shrink-0 space-x-2 transition-all relative ${
                      activeTab === 'ai' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Đánh giá chi tiết từ AI</span>
                    {activeTab === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('submission')}
                    className={`pb-4 text-sm font-bold flex items-center shrink-0 space-x-2 transition-all relative ${
                      activeTab === 'submission' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Bài làm của bạn</span>
                    {activeTab === 'submission' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
                  </button>
                  
                  {((essay.solutionImages && essay.solutionImages.length > 0) || (essay.solutionText && essay.solutionText.trim() !== '')) && (
                    <button
                      onClick={() => setActiveTab('solution')}
                      className={`pb-4 text-sm font-bold flex items-center shrink-0 space-x-2 transition-all relative ${
                        activeTab === 'solution' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Đáp án tham khảo</span>
                      {activeTab === 'solution' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
                    </button>
                  )}
                </div>

                {/* Tab: AI Review */}
                {activeTab === 'ai' && (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">Chi tiết nhận xét từ Giáo viên AI</h3>
                        <p className="text-slate-400 text-xs">Hệ thống phân tích từng chi tiết lỗi sai và gợi ý sửa đổi cho bạn</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 md:p-8 shadow-inner overflow-hidden">
                      <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
                        <ReactMarkdown
                          components={{
                            h1: ({node, children, ...props}) => <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mt-6 mb-3 flex items-center" {...props}>{renderAiFeedbackMath(children)}</h1>,
                            h2: ({node, children, ...props}) => <h2 className="text-lg font-bold text-indigo-900 mt-5 mb-2 flex items-center" {...props}>{renderAiFeedbackMath(children)}</h2>,
                            h3: ({node, children, ...props}) => <h3 className="text-md font-semibold text-slate-800 mt-4 mb-2" {...props}>{renderAiFeedbackMath(children)}</h3>,
                            p: ({node, children, ...props}) => <p className="text-slate-600 mb-4 text-sm md:text-base leading-relaxed" {...props}>{renderAiFeedbackMath(children)}</p>,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                            li: ({node, children, ...props}) => <li className="pl-1 mb-1 text-slate-600 leading-relaxed" {...props}>{renderAiFeedbackMath(children)}</li>,
                            blockquote: ({node, children, ...props}) => (
                              <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-500 my-4 bg-indigo-50/50 py-2 rounded-r-xl" {...props}>{renderAiFeedbackMath(children)}</blockquote>
                            ),
                            code: ({node, ...props}) => <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-sm" {...props} />,
                            pre: ({node, ...props}) => <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-4 text-xs font-mono" {...props} />,
                          }}
                        >
                          {processedAiFeedback}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Student Submission */}
                {activeTab === 'submission' && (
                  <div className="space-y-6">
                    {submission.images && submission.images.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-bold text-slate-800 flex items-center text-sm">
                          <ImageIcon className="w-4 h-4 mr-2 text-slate-400" /> Hình ảnh lời giải đã nộp ({submission.images.length} ảnh):
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                          {submission.images.map((img: string, idx: number) => (
                            <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:border-indigo-200 transition-all">
                              <div className="relative aspect-[3/4] bg-white border-b border-slate-100 overflow-hidden">
                                <img src={img} referrerPolicy="no-referrer" className="w-full h-full object-contain hover:scale-105 transition-transform duration-300" alt={`Bài làm ${idx + 1}`} />
                              </div>
                              <div className="p-3 text-center text-xs font-bold text-slate-500 bg-slate-50/50">
                                Ảnh chụp lời giải {idx + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-55" />
                        <p className="text-slate-500 text-xs font-medium">Không có hình ảnh bài làm nào được tìm thấy.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Reference Solution */}
                {activeTab === 'solution' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">Đáp án mẫu từ Giáo viên</h3>
                        <p className="text-slate-400 text-xs">Đối chiếu bài giải của bạn với đáp án chính thức</p>
                      </div>
                    </div>

                    {essay.solutionText && essay.solutionText.trim() !== '' && (
                      <div className="bg-emerald-50/30 rounded-2xl border border-emerald-100 p-6 md:p-8 overflow-hidden">
                        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-sans">
                          <ReactMarkdown
                            components={{
                              h1: ({node, children, ...props}) => <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mt-6 mb-3 flex items-center" {...props}>{renderSolutionMath(children)}</h1>,
                              h2: ({node, children, ...props}) => <h2 className="text-lg font-bold text-indigo-900 mt-5 mb-2 flex items-center" {...props}>{renderSolutionMath(children)}</h2>,
                              h3: ({node, children, ...props}) => <h3 className="text-md font-semibold text-slate-800 mt-4 mb-2" {...props}>{renderSolutionMath(children)}</h3>,
                              p: ({node, children, ...props}) => <p className="text-slate-600 mb-4 text-sm md:text-base leading-relaxed" {...props}>{renderSolutionMath(children)}</p>,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                              li: ({node, children, ...props}) => <li className="pl-1 mb-1 text-slate-600 leading-relaxed" {...props}>{renderSolutionMath(children)}</li>,
                              blockquote: ({node, children, ...props}) => (
                                <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-500 my-4 bg-indigo-50/50 py-2 rounded-r-xl" {...props}>{renderSolutionMath(children)}</blockquote>
                              ),
                              code: ({node, ...props}) => <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-sm" {...props} />,
                              pre: ({node, ...props}) => <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-4 text-xs font-mono" {...props} />,
                            }}
                          >
                            {processedSolutionText}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {essay.solutionImages && essay.solutionImages.length > 0 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {essay.solutionImages.map((img: string, idx: number) => (
                            <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                              <div className="relative aspect-[4/5] md:aspect-[3/4] bg-slate-50 flex items-center justify-center p-2 border-b border-slate-100">
                                <img src={img} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain" alt={`Đáp án mẫu ${idx + 1}`} />
                              </div>
                              <div className="p-3 text-center text-xs font-bold text-slate-600 bg-slate-50">
                                Hình ảnh đáp án mẫu {idx + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/student"
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200 text-center flex items-center justify-center"
              >
                Quay lại Student Dashboard
              </Link>
            </div>
          </div>
        )
      ) : (
        /* WORKSPACE / ESSAY TAKING ZONE */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-8">
            
            {/* COLUMN 1: EXAM TOPIC */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-indigo-500" /> Đề bài tự luận
                </h2>
                
                {essay.endTime && (
                  <span className="text-xs font-bold flex items-center text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 shrink-0">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Hạn: {new Date(essay.endTime).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
              
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8 flex flex-col space-y-6">
                {essay.assignmentImages && essay.assignmentImages.length > 0 ? (
                  <div className="space-y-6">
                    {essay.assignmentImages.map((img: string, idx: number) => (
                      <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50/50">
                        <div className="bg-slate-100/50 border-b border-slate-100 px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-500">
                          <span>Hình ảnh đề bài {idx + 1}</span>
                          <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-400">Trang {idx + 1}</span>
                        </div>
                        <div className="p-2 bg-white flex items-center justify-center">
                          <img src={img} alt={`Đề bài ${idx + 1}`} className="max-w-full h-auto rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Đề bài không có hình ảnh đi kèm.</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: WORKSPACE */}
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-900 flex items-center mb-2 tracking-tight">
                <Send className="w-6 h-6 mr-3 text-emerald-500" /> Nộp bài làm
              </h2>
              <p className="text-sm text-slate-500 font-medium mb-6">Tải lên hình ảnh lời giải bài tự luận của em.</p>
              
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 md:p-10 space-y-8">
                
                {/* Upload Image Section */}
                <div className="space-y-4">
                  <label className="block text-sm font-black text-slate-900 flex items-center tracking-tight">
                    <ImageIcon className="w-5 h-5 mr-2 text-indigo-500" /> Tải ảnh bài viết tay, vở nháp:
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm group bg-slate-50 flex items-center justify-center p-1 hover:border-indigo-400 transition-all">
                        <img src={img} className="max-w-full max-h-full object-contain rounded-xl" alt={`Bài làm ${idx + 1}`} />
                        <div className="absolute top-2 left-2 bg-slate-900/70 backdrop-blur-md text-white font-mono text-[11px] font-black px-2 py-0.5 rounded-lg border border-white/10 z-10">
                          Ảnh {idx + 1}
                        </div>
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all shadow-md z-10"
                          title="Xóa hình ảnh"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`aspect-[3/4] flex flex-col items-center justify-center rounded-2xl border-4 border-dashed transition-all p-4 ${
                        dragActive 
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-600 scale-[0.98]' 
                          : 'border-slate-300 bg-slate-50 hover:border-indigo-500 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600'
                      }`}
                    >
                      <Upload className="w-10 h-10 text-indigo-400 mb-3 animate-bounce" />
                      <span className="text-sm font-black block text-center">Thêm ảnh</span>
                      <span className="text-[11px] text-slate-400 font-medium block text-center mt-1">Kéo thả hoặc nhấp chọn</span>
                    </button>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      multiple 
                      onChange={(e) => handleImageUpload(e.target.files)} 
                    />
                  </div>
                </div>

                {/* Submit Error banner, perfectly inline so students never lose progress! */}
                {submitError && (
                  <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl p-4 flex items-start space-x-3 text-rose-800 animate-in fade-in slide-in-from-top-4 duration-300">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-extrabold text-sm flex items-center">Gặp sự cố khi kết nối lưu bài nộp</p>
                      <p className="text-xs text-rose-600 leading-relaxed font-medium">{submitError}</p>
                      <p className="text-xs text-slate-500 font-medium pt-1">
                        👉 Đừng lo lắng! Lời giải của bạn vẫn được lưu giữ an toàn trên màn hình này. Hãy kiểm tra kết nối mạng và nhấn nút <span className="font-bold text-indigo-600">"Nộp bài cho Thầy Trọng AI"</span> một lần nữa để thử lại.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submitting Status / Submit Button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (images.length === 0)}
                    className="w-full flex justify-center items-center px-6 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-black">{submitMessage}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <Send className="w-5 h-5" />
                        <span className="font-black">Nộp bài cho Thầy Trọng AI</span>
                      </div>
                    )}
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
