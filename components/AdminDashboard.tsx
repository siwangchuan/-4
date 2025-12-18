import React, { useState, useMemo, useRef } from 'react';
import { KNOWLEDGE_TREE, Question, QuestionType, Syllabus } from '../types';
import { parseRawQuestions, parseSyllabus } from '../services/geminiService';
import { saveQuestions, saveSyllabus } from '../services/db';
import { FolderOpen, FileInput, Plus, Save, Trash2, Database, Search, Sparkles, Loader2, ChevronRight, ChevronDown, Book, ListTree, AlignLeft, Download, Upload } from 'lucide-react';

interface AdminDashboardProps {
  questionBank: Question[];
  onUpdateBank: (questions: Question[]) => void;
  syllabuses: Syllabus[];
  onUpdateSyllabuses: (syllabuses: Syllabus[]) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ questionBank, onUpdateBank, syllabuses, onUpdateSyllabuses }) => {
  const [mainView, setMainView] = useState<'QUESTIONS' | 'MATERIALS'>('MATERIALS');
  const [activeTab, setActiveTab] = useState<'MANAGE' | 'IMPORT'>('MANAGE');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Import State for Questions
  const [importText, setImportText] = useState('');
  const [importSource, setImportSource] = useState('408 真题');
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  
  // Import State for Syllabuses
  const [syllabusText, setSyllabusText] = useState('');
  const [previewSyllabus, setPreviewSyllabus] = useState<Syllabus | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ '数据结构': true });

  const toggleNode = (node: string) => {
    setExpandedNodes(prev => ({ ...prev, [node]: !prev[node] }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportData = () => {
    const data = {
      syllabuses,
      questionBank
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aceai-knowledge-base-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportKnowledgeBase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      let newSyllabusesCount = 0;
      let newQuestionsCount = 0;

      // Import Syllabuses
      if (data.syllabuses && Array.isArray(data.syllabuses)) {
        const importedSyllabuses = data.syllabuses as Syllabus[];
        // Save to DB
        for (const s of importedSyllabuses) {
          await saveSyllabus(s);
        }
        // Update State (Merge avoiding duplicates by ID)
        const existingIds = new Set(syllabuses.map(s => s.id));
        const uniqueNew = importedSyllabuses.filter(s => !existingIds.has(s.id));
        if (uniqueNew.length > 0) {
          onUpdateSyllabuses([...syllabuses, ...uniqueNew]);
          newSyllabusesCount = uniqueNew.length;
        }
      }

      // Import Questions
      if (data.questionBank && Array.isArray(data.questionBank)) {
        const importedQuestions = data.questionBank as Question[];
        // Save to DB
        await saveQuestions(importedQuestions);
        // Update State
        const existingIds = new Set(questionBank.map(q => q.id));
        const uniqueNew = importedQuestions.filter(q => !existingIds.has(q.id));
        if (uniqueNew.length > 0) {
          onUpdateBank([...questionBank, ...uniqueNew]);
          newQuestionsCount = uniqueNew.length;
        }
      }

      alert(`导入成功！\n新增大纲: ${newSyllabusesCount} 个\n新增题目: ${newQuestionsCount} 道`);
    } catch (e) {
      console.error("Import failed", e);
      alert("导入失败，请检查文件格式是否正确。");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Merge static KNOWLEDGE_TREE with dynamic syllabuses
  const dynamicTree = useMemo(() => {
    const tree: Record<string, string[]> = { ...KNOWLEDGE_TREE };
    
    syllabuses.forEach(s => {
      // Use course name as category
      const category = s.courseName || '未命名课程';
      const topics = s.modules?.map(m => m.title) || [];
      
      if (tree[category]) {
        // Merge if exists
        tree[category] = Array.from(new Set([...tree[category], ...topics]));
      } else {
        // Add new category
        tree[category] = topics;
      }
    });
    
    return tree;
  }, [syllabuses]);

  // --- Question Logic ---
  const handleImportQuestions = async () => {
    if (!importText.trim()) return;
    setIsProcessing(true);
    try {
      const parsed = await parseRawQuestions(importText, importSource);
      setPreviewQuestions(parsed);
    } finally {
      setIsProcessing(false);
    }
  };

  const commitImportQuestions = () => {
    onUpdateBank([...questionBank, ...previewQuestions]);
    setPreviewQuestions([]);
    setImportText('');
    setActiveTab('MANAGE');
  };

  // --- Syllabus Logic ---
  const handleImportSyllabus = async () => {
    if (!syllabusText.trim()) return;
    setIsProcessing(true);
    try {
      const parsed = await parseSyllabus(syllabusText);
      setPreviewSyllabus(parsed);
    } finally {
      setIsProcessing(false);
    }
  };

  const commitImportSyllabus = () => {
    if (previewSyllabus) {
        onUpdateSyllabuses([...syllabuses, previewSyllabus]);
        setPreviewSyllabus(null);
        setSyllabusText('');
        setActiveTab('MANAGE');
    }
  };

  const filteredQuestions = selectedCategory 
    ? questionBank.filter(q => q.tags.some(t => t.includes(selectedCategory) || selectedCategory.includes(t)))
    : questionBank;

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6 animate-fade-in">
      {/* Sidebar: Navigation & Knowledge Tree */}
      <div className="w-64 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        {/* Main Nav Switcher */}
        <div className="p-2 border-b border-slate-100 grid grid-cols-2 gap-1 bg-slate-50">
            <button 
                onClick={() => { setMainView('MATERIALS'); setActiveTab('MANAGE'); }}
                className={`p-2 rounded-lg text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all ${mainView === 'MATERIALS' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                <Book size={18} />
                教学大纲
            </button>
            <button 
                onClick={() => { setMainView('QUESTIONS'); setActiveTab('MANAGE'); }}
                className={`p-2 rounded-lg text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all ${mainView === 'QUESTIONS' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                <Database size={18} />
                题库管理
            </button>
        </div>

        {/* Tree Content (Only relevant for Questions or Filtering) */}
        <div className="flex-1 overflow-y-auto p-4">
             <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">知识分类体系</h3>
             <div className="space-y-2">
                <div 
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium ${!selectedCategory ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    onClick={() => setSelectedCategory(null)}
                >
                    全部内容
                </div>
                {Object.entries(dynamicTree).map(([category, subTopics]) => (
                    <div key={category}>
                        <div 
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-slate-700 font-medium"
                            onClick={() => toggleNode(category)}
                        >
                            <span onClick={(e) => { e.stopPropagation(); setSelectedCategory(category); }}>{category}</span>
                            {expandedNodes[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                        {expandedNodes[category] && (
                            <div className="ml-4 space-y-1 mt-1 border-l-2 border-slate-100 pl-2">
                                {subTopics.map(sub => (
                                    <div 
                                        key={sub}
                                        className={`text-sm py-1 px-2 rounded cursor-pointer ${selectedCategory === sub ? 'text-indigo-600 bg-indigo-50 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                        onClick={() => setSelectedCategory(sub)}
                                    >
                                        {sub}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex gap-2">
                <button 
                    onClick={() => setActiveTab('MANAGE')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'MANAGE' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                   <ListTree size={16} /> 列表概览
                </button>
                <button 
                    onClick={() => setActiveTab('IMPORT')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <FileInput size={16} /> {mainView === 'MATERIALS' ? '导入大纲' : '导入题目'}
                </button>
            </div>
            <div className="flex items-center gap-2">
                 <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImportKnowledgeBase}
                    accept=".json"
                    className="hidden"
                 />
                 <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="导入知识库备份 (JSON)"
                 >
                    <Upload size={18} />
                 </button>
                 <button
                    onClick={handleExportData}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="导出知识库数据"
                 >
                    <Download size={18} />
                 </button>
                 <span className="text-xs text-slate-400">
                    {mainView === 'QUESTIONS' ? `共 ${filteredQuestions.length} 道题目` : `共 ${syllabuses.length} 门课程`}
                 </span>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
            
            {/* VIEW 1: SYLLABUS / MATERIALS */}
            {mainView === 'MATERIALS' && (
                <>
                    {activeTab === 'MANAGE' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {syllabuses.map(s => (
                                <div key={s.id} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">{s.courseName}</h3>
                                            <p className="text-sm text-slate-500">{s.semester || '通用学期'}</p>
                                        </div>
                                        <button 
                                            onClick={() => onUpdateSyllabuses(syllabuses.filter(x => x.id !== s.id))}
                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">{s.description}</p>
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase">课程模块</h4>
                                        {(s.modules || []).slice(0, 3).map((m, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                                                <span className="truncate">{m.title}</span>
                                            </div>
                                        ))}
                                        {(s.modules || []).length > 3 && (
                                            <div className="text-xs text-slate-400 pl-3.5">+ 还有 {(s.modules || []).length - 3} 个模块</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {syllabuses.length === 0 && (
                                <div className="col-span-full text-center py-20 text-slate-400 flex flex-col items-center">
                                    <Book size={48} className="mb-4 opacity-50" />
                                    <p>知识库为空，请点击“导入大纲”添加课程资料</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto">
                             {/* SYLLABUS IMPORT UI */}
                             {!previewSyllabus ? (
                                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">导入课程资料</h3>
                                    <p className="text-sm text-slate-500 mb-6">
                                        复制粘贴您的课程大纲、教学计划或目录文本。AI 将自动提取课程结构、章节和关键知识点，构建您的专属知识图谱。
                                    </p>
                                    <textarea 
                                        className="w-full h-80 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm mb-6"
                                        placeholder="例如：
课程名称：操作系统
简介：本课程介绍操作系统的基本概念...
第一章：引论
- 操作系统的定义
- 发展历史
第二章：进程管理
- 进程状态
- 线程模型..."
                                        value={syllabusText}
                                        onChange={(e) => setSyllabusText(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleImportSyllabus}
                                        disabled={isProcessing || !syllabusText}
                                        className="w-full py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 flex items-center justify-center gap-2 font-bold"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="animate-spin" /> 正在构建知识结构...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} /> 智能解析大纲
                                            </>
                                        )}
                                    </button>
                                </div>
                             ) : (
                                 <div className="space-y-6">
                                     <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl border border-green-100">
                                         <div className="flex items-center gap-3">
                                             <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                                 <Sparkles size={24} />
                                             </div>
                                             <div>
                                                 <h3 className="font-bold text-green-800">解析成功</h3>
                                                 <p className="text-sm text-green-600">识别出 {previewSyllabus.modules.length} 个教学模块</p>
                                             </div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button 
                                                onClick={() => setPreviewSyllabus(null)}
                                                className="px-4 py-2 text-slate-500 hover:text-slate-700"
                                             >
                                                 重新编辑
                                             </button>
                                             <button 
                                                onClick={commitImportSyllabus}
                                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                                             >
                                                 <Save size={18} /> 存入知识库
                                             </button>
                                         </div>
                                     </div>
                                     
                                     <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                                         <h1 className="text-2xl font-bold text-slate-900 mb-2">{previewSyllabus.courseName}</h1>
                                         <p className="text-slate-600 mb-8 pb-8 border-b border-slate-100">{previewSyllabus.description}</p>
                                         
                                         <div className="space-y-6">
                                             {previewSyllabus.modules.map((mod, i) => (
                                                 <div key={i} className="flex gap-4">
                                                     <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                         {i + 1}
                                                     </div>
                                                     <div>
                                                         <h4 className="font-bold text-slate-800 mb-2">{mod.title}</h4>
                                                         <div className="flex flex-wrap gap-2">
                                                             {mod.keyPoints.map((kp, k) => (
                                                                 <span key={k} className="px-2 py-1 bg-slate-50 text-slate-600 text-sm rounded border border-slate-100">
                                                                     {kp}
                                                                 </span>
                                                             ))}
                                                         </div>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 </div>
                             )}
                        </div>
                    )}
                </>
            )}

            {/* VIEW 2: QUESTIONS */}
            {mainView === 'QUESTIONS' && (
                <>
                    {activeTab === 'MANAGE' ? (
                        <div className="space-y-4">
                             {filteredQuestions.length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <Database size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>该分类下暂无题目</p>
                                </div>
                            ) : (
                                filteredQuestions.map(q => (
                                    <div key={q.id} className="bg-white p-4 border border-slate-100 rounded-lg hover:border-indigo-200 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-2 items-center">
                                                <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                                                    q.type === 'SINGLE_CHOICE' ? 'bg-blue-100 text-blue-700' :
                                                    q.type === 'CODE' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>{q.type}</span>
                                                <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100">
                                                    {q.source || '未知来源'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-slate-400"
                                                    onClick={() => onUpdateBank(questionBank.filter(x => x.id !== q.id))}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <h4 className="font-medium text-slate-800 line-clamp-2 mb-2">{q.text}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {q.tags.map((t, i) => (
                                                <span key={i} className="text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">#{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                         <div className="max-w-3xl mx-auto">
                             {/* QUESTION IMPORT UI */}
                             {!previewQuestions.length ? (
                                 <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                                     <h3 className="text-lg font-bold text-slate-800 mb-6">批量导入题目</h3>
                                     <div className="space-y-6">
                                         <div>
                                             <label className="block text-sm font-medium text-slate-700 mb-2">题目来源</label>
                                             <select 
                                                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                                                value={importSource}
                                                onChange={(e) => setImportSource(e.target.value)}
                                             >
                                                 <option value="408 真题">408 计算机考研真题</option>
                                                 <option value="校招笔试">互联网大厂校招笔试</option>
                                                 <option value="期末试卷">高校期末试卷 (图片OCR文本)</option>
                                                 <option value="个人整理">个人整理</option>
                                             </select>
                                         </div>
                                         <div>
                                             <label className="block text-sm font-medium text-slate-700 mb-2">粘贴题目文本</label>
                                             <textarea 
                                                className="w-full h-64 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                                placeholder="在此粘贴整个试卷的文本内容... AI 将自动识别题目、选项和类型。"
                                                value={importText}
                                                onChange={(e) => setImportText(e.target.value)}
                                             />
                                             <p className="text-xs text-slate-400 mt-2">提示：直接从 PDF 或 Word 复制即可，无需手动排版。</p>
                                         </div>
                                         <button 
                                            onClick={handleImportQuestions}
                                            disabled={isProcessing || !importText}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 flex items-center justify-center gap-2 font-medium"
                                         >
                                             {isProcessing ? (
                                                 <>
                                                     <Loader2 className="animate-spin" /> 正在 AI 解析...
                                                 </>
                                             ) : (
                                                 <>
                                                     <Sparkles size={18} /> 开始智能识别
                                                 </>
                                             )}
                                         </button>
                                     </div>
                                 </div>
                             ) : (
                                 <div className="space-y-6">
                                     <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl border border-green-100">
                                         <h3 className="text-lg font-bold text-green-600 flex items-center gap-2">
                                             <Sparkles size={20} /> 成功识别 {previewQuestions.length} 道题目
                                         </h3>
                                         <div className="flex gap-2">
                                             <button 
                                                onClick={() => setPreviewQuestions([])}
                                                className="px-4 py-2 text-slate-500 hover:text-slate-700"
                                             >
                                                 取消
                                             </button>
                                             <button 
                                                onClick={commitImportQuestions}
                                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                                             >
                                                 <Save size={18} /> 确认入库
                                             </button>
                                         </div>
                                     </div>
                                     
                                     <div className="space-y-4 border rounded-xl p-4 bg-slate-50 max-h-[60vh] overflow-y-auto">
                                         {previewQuestions.map((q, i) => (
                                             <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                                 <div className="flex justify-between mb-2">
                                                     <span className="text-xs font-bold text-indigo-600 uppercase">{q.type}</span>
                                                     <span className="text-xs bg-slate-100 px-2 rounded text-slate-500">{q.difficulty || 'Medium'}</span>
                                                 </div>
                                                 <p className="font-medium text-slate-800 mb-2">{q.text}</p>
                                                 {q.options && (
                                                     <div className="grid grid-cols-2 gap-2 mb-2">
                                                         {q.options.map((opt, oi) => (
                                                             <div key={oi} className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">{opt}</div>
                                                         ))}
                                                     </div>
                                                 )}
                                                 <div className="text-xs text-slate-500 mt-2">
                                                     <span className="font-bold">参考答案:</span> {String(q.correctAnswer)}
                                                 </div>
                                                 <div className="text-xs text-slate-500 mt-1">
                                                     <span className="font-bold">解析:</span> {q.explanation}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;