const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf8');

const oldMap = `                    {essays.map((essay) => {
                      const isAvailable = !essay.startTime || new Date(essay.startTime) <= new Date();
                      const isEnded = essay.endTime && new Date(essay.endTime) < new Date();
                      const hasSubmitted = (appUser as any)?.completedEssays?.some((s: any) => s.essayId === essay.id);
                      
                      return (`;

const newMap = `                    {essays.map((essay) => {
                      const isAvailable = !essay.startTime || new Date(essay.startTime) <= new Date();
                      const isEnded = essay.endTime && new Date(essay.endTime) < new Date();
                      const submissionInfo = (appUser as any)?.completedEssays?.find((s: any) => s.essayId === essay.id);
                      const hasSubmitted = !!submissionInfo;
                      const isGraded = submissionInfo && (submissionInfo.status === 'graded' || (submissionInfo.score !== undefined && submissionInfo.score !== null));
                      
                      return (`;

code = code.replace(oldMap, newMap);

const oldActions = `                            <div className="flex items-center space-x-4">
                              {hasSubmitted ? (
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center text-emerald-600 font-semibold text-sm mb-2 bg-emerald-50 px-3 py-1 rounded-full">
                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                    Đã hoàn thành
                                  </div>
                                  <Link
                                    to={\`/student/essay/\${essay.id}\`}
                                    className="inline-flex items-center px-5 py-2.5 border border-gray-200 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all transform hover:-translate-y-0.5"
                                  >
                                    Xem kết quả
                                  </Link>
                                </div>
                              ) : (`;

const newActions = `                            <div className="flex items-center space-x-4">
                              {hasSubmitted ? (
                                <div className="flex flex-col items-end">
                                  <div className={\`flex items-center font-semibold text-sm mb-2 px-3 py-1 rounded-full \${isGraded ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}\`}>
                                    {isGraded ? <CheckCircle className="w-4 h-4 mr-1.5" /> : <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                                    {isGraded ? 'Đã chấm điểm' : 'Đang chờ chấm'}
                                  </div>
                                  <Link
                                    to={\`/student/essay/\${essay.id}\`}
                                    className="inline-flex items-center px-5 py-2.5 border border-gray-200 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all transform hover:-translate-y-0.5"
                                  >
                                    {isGraded ? 'Xem kết quả' : 'Xem bài làm'}
                                  </Link>
                                </div>
                              ) : (`;

code = code.replace(oldActions, newActions);

fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
console.log("Patched StudentDashboard.tsx");
