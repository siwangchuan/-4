import React, { useState, useEffect } from 'react';
import { ViewState, QuizSession, UserStats, Question, QuestionType, Syllabus } from './types';
import StudentDashboard from './components/StudentDashboard';
import UploadSection from './components/UploadSection';
import QuizInterface from './components/QuizInterface';
import AdminDashboard from './components/AdminDashboard';
import { generateQuiz, generateStudyPlan, analyzeAndImportFile, generateQuizFromKnowledgeBase } from './services/geminiService';
import { saveSyllabus, saveQuestions, findRelevantQuestions, getAllQuestions, getAllSyllabuses, findRelevantSyllabuses } from './services/db';
import { GraduationCap, ArrowLeft, Lightbulb, Settings, UserCircle } from 'lucide-react';

const MOCK_STATS: UserStats = {
  totalQuizzes: 12,
  averageScore: 78,
  topicStrength: {
    '算法': 85,
    '数据结构': 60,
    '计算机网络': 75,
    '操作系统': 90,
    '数据库': 50,
  },
  recentActivity: [
    { date: '2023-10-01', score: 65 },
    { date: '2023-10-02', score: 70 },
    { date: '2023-10-05', score: 85 },
    { date: '2023-10-08', score: 92 },
  ],
  weakPoints: ['动态规划', 'B树', 'SQL 连接查询']
};

const INITIAL_BANK: Question[] = [
  {
      id: 'init-1',
      type: QuestionType.SINGLE_CHOICE,
      text: '在OSI参考模型中，负责提供可靠端到端数据传输的是哪一层？',
      options: ['应用层', '传输层', '网络层', '数据链路层'],
      correctAnswer: '传输层',
      explanation: '传输层负责端到端的连接和可靠性传输（如TCP协议）。',
      tags: ['计算机网络', 'TCP/IP'],
      source: '408 真题',
      difficulty: 'Medium'
  }
];

const INITIAL_SYLLABUSES: Syllabus[] = [
    {
        id: 'syl-1',
        courseName: '计算机网络（Computer Networks）',
        description: '本课程主要介绍计算机网络的基本概念、体系结构和通信协议。重点讲解TCP/IP协议簇。',
        addedAt: Date.now(),
        modules: [
            { title: '第一章：概述', keyPoints: ['互联网边缘', '互联网核心', '协议分层'] },
            { title: '第二章：应用层', keyPoints: ['Web与HTTP', 'DNS', 'P2P应用', 'Socket编程'] },
            { title: '第三章：传输层', keyPoints: ['UDP', '可靠数据传输', 'TCP', '拥塞控制'] }
        ]
    }
];

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [stats, setStats] = useState<UserStats>(MOCK_STATS);
  const [currentSession, setCurrentSession] = useState<QuizSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [studyPlan, setStudyPlan] = useState<string>('');
  const [questionBank, setQuestionBank] = useState<Question[]>(INITIAL_BANK);
  const [syllabuses, setSyllabuses] = useState<Syllabus[]>(INITIAL_SYLLABUSES);

  useEffect(() => {
    const loadData = async () => {
      try {
        const questions = await getAllQuestions();
        const syllabuses = await getAllSyllabuses();
        // Merge with initial data, avoiding duplicates if needed, but for now just append or replace
        // Since INITIAL_BANK has hardcoded IDs, we might want to keep them.
        // But if DB has data, maybe we should prioritize it.
        // For simplicity, let's just add DB data to state.
        if (questions.length > 0) setQuestionBank(prev => {
            const existingIds = new Set(prev.map(q => q.id));
            const newQs = questions.filter(q => !existingIds.has(q.id));
            return [...prev, ...newQs];
        });
        if (syllabuses.length > 0) setSyllabuses(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSs = syllabuses.filter(s => !existingIds.has(s.id));
            return [...prev, ...newSs];
        });
      } catch (e) {
        console.error("Failed to load data from DB", e);
      }
    };
    loadData();
  }, []);

  const handleGenerateQuiz = async (
    files: {data: string, type: string, name: string}[], 
    config: {topic: string, difficulty: string, count: number}
  ) => {
    setIsLoading(true);
    try {
        // 1. If files are uploaded, analyze and import them FIRST
        if (files.length > 0) {
            console.log("Processing uploaded files...");
            const importResult = await analyzeAndImportFile(files, config.topic);
            
            if (importResult) {
                if (importResult.syllabus) {
                    const newSyllabus = importResult.syllabus;
                    await saveSyllabus(newSyllabus);
                    setSyllabuses(prev => [newSyllabus, ...prev]);
                    console.log("Imported and saved syllabus:", newSyllabus.courseName);
                }
                
                if (importResult.questions && importResult.questions.length > 0) {
                    const newQuestions = importResult.questions;
                    await saveQuestions(newQuestions);
                    setQuestionBank(prev => [...prev, ...newQuestions]);
                    console.log(`Imported and saved ${newQuestions.length} questions.`);
                }
            }
        }

        // 2. Search for relevant context in local DB (now includes just imported data)
        let relevantExamples: Question[] = [];
        let relevantSyllabuses: Syllabus[] = [];
        
        try {
            relevantExamples = await findRelevantQuestions(config.topic);
            relevantSyllabuses = await findRelevantSyllabuses(config.topic);
            console.log(`Found ${relevantExamples.length} examples and ${relevantSyllabuses.length} syllabuses for topic: ${config.topic}`);
        } catch (dbError) {
            console.warn("Failed to search local DB:", dbError);
        }

        // 3. Generate Quiz using the comprehensive context
        // Pick top 5 examples to avoid token limit
        const examplesToUse = relevantExamples.slice(0, 5);
        
        const questions = await generateQuizFromKnowledgeBase(
            config.topic, 
            config.difficulty, 
            config.count, 
            examplesToUse,
            relevantSyllabuses
        );

        const newSession: QuizSession = {
            id: Date.now().toString(),
            title: `${config.topic} - ${config.difficulty}`,
            questions: questions,
            answers: {},
            isCompleted: false,
            score: 0,
            startTime: Date.now()
        };
        setCurrentSession(newSession);
        setView('QUIZ');
    } catch (e: any) {
        console.error("Quiz Generation Error:", e);
        const errorMessage = e.message || "未知错误";
        if (errorMessage.includes("API key") || errorMessage.includes("403") || errorMessage.includes("401")) {
             alert(`无法生成测验: API Key 无效或缺失。\n请检查 .env.local 文件中的 DASHSCOPE_API_KEY 设置。\n如果刚刚修改了配置，请尝试重启开发服务器。`);
        } else {
             alert(`无法生成测验，请检查网络连接。\n错误详情: ${errorMessage}`);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleQuizFinish = (finishedSession: QuizSession) => {
    setCurrentSession(finishedSession);
    
    // Update stats strictly for demo purposes (simple logic)
    setStats(prev => ({
        ...prev,
        totalQuizzes: prev.totalQuizzes + 1,
        averageScore: (prev.averageScore * prev.totalQuizzes + finishedSession.score * 100) / (prev.totalQuizzes + 1),
        recentActivity: [...prev.recentActivity, { date: new Date().toISOString(), score: finishedSession.score * 100 }]
    }));
    
    setView('RESULTS');
  };

  const handleViewPlan = async () => {
      setIsLoading(true);
      try {
        const plan = await generateStudyPlan(stats.weakPoints, stats.recentActivity.slice(-3).map(a => a.score));
        setStudyPlan(plan);
        setView('PLAN');
      } finally {
          setIsLoading(false);
      }
  };

  const renderContent = () => {
    switch (view) {
      case 'DASHBOARD':
        return (
          <StudentDashboard 
            stats={stats} 
            onStartNew={() => setView('UPLOAD')} 
            onViewPlan={handleViewPlan} 
          />
        );
      case 'UPLOAD':
        return (
          <UploadSection onGenerate={handleGenerateQuiz} isLoading={isLoading} />
        );
      case 'QUIZ':
        if (!currentSession) return <div>加载测验失败</div>;
        return (
          <QuizInterface session={currentSession} onFinish={handleQuizFinish} />
        );
      case 'RESULTS':
         if (!currentSession) return null;
         return (
             <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
                 <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">本次测验完成！</h2>
                 <div className="text-center mb-8">
                    <span className="text-6xl font-bold text-indigo-600">{(currentSession.score * 100).toFixed(0)}</span>
                    <span className="text-xl text-slate-400">/100</span>
                 </div>
                 <div className="space-y-4">
                     {currentSession.questions.map((q, i) => (
                         <div key={q.id} className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                             <div className="flex justify-between mb-2">
                                 <span className="font-semibold text-slate-700">第 {i+1} 题: {q.text}</span>
                                 <span className={currentSession.answers[q.id]?.isCorrect ? 'text-green-600' : 'text-red-600 font-bold'}>
                                     {currentSession.answers[q.id]?.isCorrect ? '通过' : '需复习'}
                                 </span>
                             </div>
                             {!currentSession.answers[q.id]?.isCorrect && (
                                 <p className="text-sm text-slate-600 italic">{currentSession.answers[q.id]?.aiFeedback}</p>
                             )}
                         </div>
                     ))}
                 </div>
                 <button onClick={() => setView('DASHBOARD')} className="mt-8 w-full py-3 bg-indigo-600 text-white rounded-lg">返回仪表盘</button>
             </div>
         );
      case 'PLAN':
          return (
              <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
                  <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                      <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                          <Lightbulb size={24} />
                      </div>
                      <div>
                          <h2 className="text-2xl font-bold text-slate-800">AI 学习计划</h2>
                          <p className="text-slate-500">根据您的近期表现为您定制</p>
                      </div>
                  </div>
                  {isLoading ? (
                      <div className="text-center py-10 text-slate-500">正在生成个性化计划...</div>
                  ) : (
                      <div className="prose prose-slate max-w-none">
                          <div className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed">
                            {studyPlan}
                          </div>
                      </div>
                  )}
                  <button onClick={() => setView('DASHBOARD')} className="mt-8 w-full py-3 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">关闭</button>
              </div>
          );
      case 'ADMIN':
          return (
              <AdminDashboard 
                questionBank={questionBank} 
                onUpdateBank={setQuestionBank}
                syllabuses={syllabuses}
                onUpdateSyllabuses={setSyllabuses}
              />
          );
      default:
        return <div>未实现</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('DASHBOARD')}>
            <div className="bg-indigo-600 text-white p-2 rounded-lg">
              <GraduationCap size={24} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              AceAI - 智能助学
            </span>
          </div>
          <div className="flex items-center gap-4">
             {/* Admin / Student Toggle */}
             {view === 'ADMIN' ? (
                 <button 
                    onClick={() => setView('DASHBOARD')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                 >
                    <UserCircle size={18} /> 返回学生视角
                 </button>
             ) : (
                 <button 
                    onClick={() => setView('ADMIN')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                 >
                    <Settings size={18} /> 知识库管理
                 </button>
             )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;