cat server.ts | awk '
BEGIN { in_grade = 0 }
/app.post\("\/api\/grade-essay"/ { in_grade = 1; print "REPLACE_GRADE_HERE"; next }
in_grade {
  if (/^  \}\);/) {
    in_grade = 0;
    next;
  }
  next;
}
!in_grade { print }
' > server.ts.tmp
