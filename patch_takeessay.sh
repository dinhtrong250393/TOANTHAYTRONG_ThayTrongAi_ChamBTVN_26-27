awk '
/\{essay.assignmentImages \&\& essay.assignmentImages.length > 0 \? \(/ {
    print "                {essay.questionText && (";
    print "                  <div className=\"bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6\">";
    print "                    <h4 className=\"text-lg font-bold text-slate-800 mb-4 flex items-center\">";
    print "                      <FileText className=\"w-5 h-5 mr-2 text-indigo-500\" />";
    print "                      Nội dung đề bài";
    print "                    </h4>";
    print "                    <div className=\"prose max-w-none text-slate-700 whitespace-pre-wrap font-medium leading-relaxed\">";
    print "                      {essay.questionText}";
    print "                    </div>";
    print "                  </div>";
    print "                )}";
    print $0;
    next;
}
{ print $0 }
' src/pages/TakeEssay.tsx > temp.tsx && mv temp.tsx src/pages/TakeEssay.tsx
