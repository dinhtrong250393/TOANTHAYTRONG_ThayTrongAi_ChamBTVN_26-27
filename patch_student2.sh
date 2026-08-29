awk '
/Làm bài tập tự luận/ {
    print $0;
    getline;
    print $0;
    print "            <button";
    print "              onClick={() => setActiveTab('\''textbook'\'')}";
    print "              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${";
    print "                activeTab === '\''textbook'\''";
    print "                  ? '\''bg-indigo-600/10 text-indigo-400 font-bold'\''";
    print "                  : '\''text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'\''";
    print "              }`}";
    print "            >";
    print "              <BookOpen className=\"w-5 h-5 mr-2 md:mr-3\" strokeWidth={activeTab === '\''textbook'\'' ? 2.5 : 1.5} />";
    print "              Bài tập SGK";
    print "            </button>";
    next;
}
{ print $0 }
' src/pages/StudentDashboard.tsx > temp.tsx && mv temp.tsx src/pages/StudentDashboard.tsx
