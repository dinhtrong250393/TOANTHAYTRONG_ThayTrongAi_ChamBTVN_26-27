import fs from 'fs';
let content = fs.readFileSync('src/pages/TextbookBuilder.tsx', 'utf8');

const stateBlock = `  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(0);
`;
content = content.replace(
  /  const \[croppedBase64, setCroppedBase64\] = useState<string>\(''\);/,
  stateBlock + '  const [croppedBase64, setCroppedBase64] = useState<string>(\'\');'
);

const oldOnSelectFile = `  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || '');
        setStep('crop');
      });
      reader.readAsDataURL(file);
    }
  };`;

const newOnSelectFile = `  const processPdf = async (file: File) => {
    setIsAnalyzing(true);
    setUploadProgress('Đang tải và xử lý file PDF...');
    setStep('analyze'); 
    
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = \`https://unpkg.com/pdfjs-dist@\${pdfjsLib.version}/build/pdf.worker.min.mjs\`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setUploadProgress(\`Đang trích xuất \${pdf.numPages} trang...\`);
      
      const images = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); 
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL('image/jpeg', 0.9));
      }
      
      if (images.length > 0) {
        setPdfImages(images);
        setImageSrc(images[0]);
        setCurrentPdfPage(0);
        setStep('crop');
      } else {
        alert('Không tìm thấy trang nào trong file PDF');
        setStep('upload');
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi đọc file PDF. Vui lòng thử lại với ảnh JPG/PNG.');
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
      setUploadProgress('');
    }
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      setCompletedCrop(null);
      setPdfImages([]);
      setCurrentPdfPage(0);
      
      const file = e.target.files[0];
      setSelectedFile(file);
      
      if (file.type === 'application/pdf') {
        processPdf(file);
      } else {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          setImageSrc(reader.result?.toString() || '');
          setStep('crop');
        });
        reader.readAsDataURL(file);
      }
    }
  };`;

content = content.replace(oldOnSelectFile, newOnSelectFile);

content = content.replace(
  /<input type="file" accept="image\/\*" onChange=\{onSelectFile\} className="hidden" \/>/g,
  '<input type="file" accept="image/*,application/pdf" onChange={onSelectFile} className="hidden" />'
);

const cropUiHeader = `            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <Crop className="w-6 h-6 mr-2 text-indigo-500" />
                Khoanh vùng MỘT bài tập
              </h2>`;

const newCropUiHeader = `            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  <Crop className="w-6 h-6 mr-2 text-indigo-500" />
                  Khoanh vùng MỘT bài tập
                </h2>
                {pdfImages.length > 1 && (
                  <div className="flex items-center space-x-4 mt-3">
                    <button 
                      onClick={() => {
                        const newPage = Math.max(0, currentPdfPage - 1);
                        setCurrentPdfPage(newPage);
                        setImageSrc(pdfImages[newPage]);
                        setCrop(undefined);
                        setCompletedCrop(null);
                      }}
                      disabled={currentPdfPage === 0}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      Trang trước
                    </button>
                    <span className="text-sm font-bold text-slate-600">Trang {currentPdfPage + 1} / {pdfImages.length}</span>
                    <button 
                      onClick={() => {
                        const newPage = Math.min(pdfImages.length - 1, currentPdfPage + 1);
                        setCurrentPdfPage(newPage);
                        setImageSrc(pdfImages[newPage]);
                        setCrop(undefined);
                        setCompletedCrop(null);
                      }}
                      disabled={currentPdfPage === pdfImages.length - 1}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      Trang sau
                    </button>
                  </div>
                )}
              </div>`;

content = content.replace(cropUiHeader, newCropUiHeader);

fs.writeFileSync('src/pages/TextbookBuilder.tsx', content);
