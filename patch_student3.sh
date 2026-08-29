awk '
/<\/main>/ {
    print "          {activeTab === '\''textbook'\'' && (";
    print "            <div className=\"animate-in fade-in slide-in-from-bottom-4 duration-500\">";
    print "              <StudentTextbookTab essays={essays} submissions={(appUser as any)?.completedEssays || []} />";
    print "            </div>";
    print "          )}";
}
{ print $0 }
' src/pages/StudentDashboard.tsx > temp.tsx && mv temp.tsx src/pages/StudentDashboard.tsx
