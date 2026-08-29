awk '
/      {itemToDelete && \(/ {
    skip=1;
}
skip {
    if ($0 ~ /^  \);$/) {
        skip=0;
    }
    next;
}
{ print $0 }
' src/components/TeacherTextbookTab.tsx > temp.tsx && mv temp.tsx src/components/TeacherTextbookTab.tsx
