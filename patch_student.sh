sed -i "s/useState<'profile' | 'knowledge' | 'exams' | 'essays'>/useState<'profile' | 'knowledge' | 'exams' | 'essays' | 'textbook'>/" src/pages/StudentDashboard.tsx
sed -i "s/if (activeTab === 'knowledge' || activeTab === 'exams' || activeTab === 'essays') {/if (activeTab === 'knowledge' || activeTab === 'exams' || activeTab === 'essays' || activeTab === 'textbook') {/g" src/pages/StudentDashboard.tsx

# Add import StudentTextbookTab
sed -i "/import { PenTool } from 'lucide-react';/a import StudentTextbookTab from '../components/StudentTextbookTab';" src/pages/StudentDashboard.tsx

# Find line: {activeTab === 'essays' && 'Làm bài tập tự luận'}
# Add: {activeTab === 'textbook' && 'Bài tập SGK'}
sed -i "/{activeTab === 'essays' && 'Làm bài tập tự luận'}/a\              {activeTab === 'textbook' \&\& 'Bài tập SGK'}" src/pages/StudentDashboard.tsx

# Add the Tab Button for Textbook right after Essays tab button (around line 286-291)
# Actually, I'll use awk to insert it correctly
