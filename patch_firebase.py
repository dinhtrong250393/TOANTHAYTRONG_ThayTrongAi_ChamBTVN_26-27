import re

with open('src/lib/firebase.ts', 'r', encoding='utf8') as f:
    c = f.read()

c = re.sub(
    r"export const syncTeacherSummary = async \(teacherId: string\) => \{.*?\n\};",
    """export const syncTeacherSummary = async (teacherId: string) => {
  // Deprecated: We no longer sync to teacher_summaries to save quota.
  // TeacherDashboard now fetches directly.
  return;
};""",
    c,
    flags=re.DOTALL
)

with open('src/lib/firebase.ts', 'w', encoding='utf8') as f:
    f.write(c)
