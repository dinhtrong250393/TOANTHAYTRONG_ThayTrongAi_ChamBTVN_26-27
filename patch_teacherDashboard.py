import re

with open('src/pages/TeacherDashboard.tsx', 'r', encoding='utf8') as f:
    c = f.read()

c = re.sub(
    r"      // Force sync on refresh.*?\n.*?const qKnowledges.*?\n.*?const knowledgeSnap.*?\n.*?knowledgesList.*?\n      \}",
    """      let examsList = [];
      let knowledgesList = [];
      
      const qExams = query(collection(db, 'exams'), where('teacherId', '==', appUser.uid));
      const examSnap = await getDocs(qExams);
      examsList = examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const qKnowledges = query(collection(db, 'knowledges'), where('teacherId', '==', appUser.uid));
      const knowledgeSnap = await getDocs(qKnowledges);
      knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));""",
    c,
    flags=re.DOTALL
)

with open('src/pages/TeacherDashboard.tsx', 'w', encoding='utf8') as f:
    f.write(c)
