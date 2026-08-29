awk '
/const sortedEssays = sortItemsByTitleNumber\(essays\);/ {
    print "  const regularEssays = essays.filter(e => !e.textbookLessonId);"
    print "  const sortedEssays = sortItemsByTitleNumber(regularEssays);"
    next;
}
{ print $0 }
' src/pages/StudentDashboard.tsx > temp.tsx && mv temp.tsx src/pages/StudentDashboard.tsx
