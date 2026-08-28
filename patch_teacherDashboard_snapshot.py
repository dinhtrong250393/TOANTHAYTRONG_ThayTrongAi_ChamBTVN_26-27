import re

with open('src/pages/TeacherDashboard.tsx', 'r', encoding='utf8') as f:
    c = f.read()

c = re.sub(
    r"    let unsubscribe: \(\(\) => void\) \| undefined;\n    if \(appUser\?\.uid && dashboardCache\.exams === null\) \{\n      const summaryRef = doc\(db, 'teacher_summaries'.*?      \);\n    \}\n    return \(\) => \{\n      if \(unsubscribe\) unsubscribe\(\);\n    \};",
    "",
    c,
    flags=re.DOTALL
)

with open('src/pages/TeacherDashboard.tsx', 'w', encoding='utf8') as f:
    f.write(c)
