import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Question, QuestionType, QuizSession, UserAnswer } from '../types';
import { CheckCircle2, AlertCircle, HelpCircle, Code, PenTool, Image as ImageIcon, Send } from 'lucide-react';
import { gradeAnswer } from '../services/geminiService';

interface QuizInterfaceProps {
  session: QuizSession;
  onFinish: (finalSession: QuizSession) => void;
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ session, onFinish }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [liveFeedback, setLiveFeedback] = useState<UserAnswer | null>(null);
  
  // Refs for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const question = session.questions[currentIdx];

  const handleAnswerChange = (val: string | string[] | File) => {
    setAnswers(prev => ({
      ...prev,
      [question.id]: {
        questionId: question.id,
        answer: val
      }
    }));
    // Clear previous live feedback when answer changes
    if (liveFeedback?.questionId === question.id) {
        setLiveFeedback(null);
    }
  };

  const handleNext = () => {
    setShowHint(false);
    setLiveFeedback(null);
    if (currentIdx < session.questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const checkSingleAnswer = async () => {
    setIsSubmitting(true);
    const userAns = answers[question.id];
    if (!userAns) {
        setIsSubmitting(false);
        return;
    }

    try {
        const result = await gradeAnswer(question, userAns.answer);
        const enrichedAnswer: UserAnswer = {
            ...userAns,
            isCorrect: result.isCorrect,
            score: result.score,
            aiFeedback: result.feedback
        };
        
        // Update local answers state with graded result
        setAnswers(prev => ({
            ...prev,
            [question.id]: enrichedAnswer
        }));
        
        setLiveFeedback(enrichedAnswer);
    } catch (e) {
        console.error("Grading failed", e);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    // Calculate total score and wrap up
    const totalScore = (Object.values(answers) as UserAnswer[]).reduce((acc, curr) => acc + (curr.score || 0), 0);
    const avgScore = totalScore / session.questions.length;
    
    onFinish({
        ...session,
        answers,
        score: avgScore,
        isCompleted: true
    });
  };

  // Render different input types
  const renderInput = () => {
    switch (question.type) {
      case QuestionType.SINGLE_CHOICE:
        return (
          <div className="space-y-3">
            {question.options?.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswerChange(opt)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  (answers[question.id]?.answer as string) === opt
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-300 text-sm text-slate-500 mr-3">
                        {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                </div>
              </button>
            ))}
          </div>
        );

      case QuestionType.MULTI_CHOICE:
        const currentSelection = (answers[question.id]?.answer as string[]) || [];
        return (
          <div className="space-y-3">
             {question.options?.map((opt, idx) => {
                const isSelected = currentSelection.includes(opt);
                return (
                    <button
                        key={idx}
                        onClick={() => {
                            const newSel = isSelected 
                                ? currentSelection.filter(s => s !== opt)
                                : [...currentSelection, opt];
                            handleAnswerChange(newSel);
                        }}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                         <div className="flex items-center">
                            <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                                {isSelected && <CheckCircle2 size={14} className="text-white" />}
                            </div>
                            <span>{opt}</span>
                        </div>
                    </button>
                );
             })}
          </div>
        );

      case QuestionType.CODE:
        return (
            <div className="relative">
                <div className="absolute top-2 right-2 text-xs text-slate-400 font-mono">Python/JS/C++</div>
                <textarea
                    className="w-full h-64 bg-slate-900 text-slate-100 font-mono p-4 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none code-scroll"
                    placeholder="// 在此输入代码解决方案..."
                    value={(answers[question.id]?.answer as string) || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    spellCheck={false}
                />
            </div>
        );

      case QuestionType.DIAGRAM:
        return (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                        if (e.target.files?.[0]) handleAnswerChange(e.target.files[0]);
                    }}
                />
                <div className="flex flex-col items-center justify-center text-slate-500">
                    {answers[question.id]?.answer instanceof File ? (
                        <>
                             <img 
                                src={URL.createObjectURL(answers[question.id].answer as File)} 
                                alt="Preview" 
                                className="max-h-64 rounded-lg shadow-md mb-4"
                             />
                             <span className="text-sm font-medium text-indigo-600">点击更换图片</span>
                        </>
                    ) : (
                        <>
                            <ImageIcon size={48} className="mb-4 text-slate-400" />
                            <span className="font-medium">点击上传图表或绘图</span>
                            <span className="text-sm text-slate-400 mt-1">AI 将自动分析您的图片</span>
                        </>
                    )}
                </div>
            </div>
        );

      default: // FILL_IN_BLANK, ESSAY
        return (
            <textarea
                className="w-full h-40 p-4 rounded-lg border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none resize-none"
                placeholder="在此输入您的答案..."
                value={(answers[question.id]?.answer as string) || ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
            />
        );
    }
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    const map: Record<QuestionType, string> = {
        [QuestionType.SINGLE_CHOICE]: '单选题',
        [QuestionType.MULTI_CHOICE]: '多选题',
        [QuestionType.FILL_IN_BLANK]: '填空题',
        [QuestionType.CODE]: '代码题',
        [QuestionType.ESSAY]: '问答题',
        [QuestionType.DIAGRAM]: '绘图分析题',
    };
    return map[type] || type;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
            <span>进度: {currentIdx + 1} / {session.questions.length}</span>
            <span className="font-medium text-slate-700">{getQuestionTypeLabel(question.type)}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / session.questions.length) * 100}%` }}
            />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Question Header */}
        <div className="p-8 border-b border-slate-100">
            <div className="flex gap-2 mb-4">
                {question.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        {tag}
                    </span>
                ))}
            </div>
            <h2 className="text-xl font-semibold text-slate-800 leading-relaxed">
                {question.text}
            </h2>
            {question.codeSnippet && (
                <pre className="mt-4 p-4 bg-slate-900 text-slate-200 rounded-lg text-sm font-mono overflow-x-auto code-scroll">
                    <code>{question.codeSnippet}</code>
                </pre>
            )}
        </div>

        {/* Answer Section */}
        <div className="p-8 bg-slate-50/50">
            {renderInput()}
            
            {/* Live Feedback Area */}
            {liveFeedback && (
                <div className={`mt-6 p-4 rounded-lg border ${liveFeedback.isCorrect ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'} animate-fade-in`}>
                    <div className="flex items-start gap-3">
                        {liveFeedback.isCorrect ? (
                            <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                            <h4 className={`font-semibold ${liveFeedback.isCorrect ? 'text-green-800' : 'text-amber-800'}`}>
                                {liveFeedback.isCorrect ? '回答正确！' : '需改进'}
                            </h4>
                            <p className="text-sm text-slate-700 mt-1">{liveFeedback.aiFeedback}</p>
                            {!liveFeedback.isCorrect && (
                                <div className="mt-2 text-xs text-slate-500">
                                    <span className="font-bold">参考答案:</span> {Array.isArray(question.correctAnswer) ? '请见选项' : question.correctAnswer}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hint Area */}
            {showHint && question.hint && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-sm flex gap-3 animate-fade-in">
                    <HelpCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{question.hint}</p>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center">
            <button 
                onClick={() => setShowHint(!showHint)}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium"
                disabled={!question.hint}
            >
                <HelpCircle size={18} />
                {showHint ? '隐藏提示' : '显示提示'}
            </button>

            <div className="flex gap-3">
                {/* Only show Grade button for non-MCQ or if not yet graded */}
                {!liveFeedback && (
                    <button 
                        onClick={checkSingleAnswer}
                        disabled={isSubmitting || !answers[question.id]}
                        className={`px-6 py-2.5 rounded-lg font-medium text-white flex items-center gap-2 transition-all ${
                            isSubmitting || !answers[question.id] 
                            ? 'bg-slate-300 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'
                        }`}
                    >
                       {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                分析中...
                            </>
                       ) : (
                            <>
                                <Send size={18} />
                                提交答案
                            </>
                       )}
                    </button>
                )}
                
                {liveFeedback && (
                    <button 
                        onClick={handleNext}
                        className="px-6 py-2.5 rounded-lg font-medium bg-slate-800 text-white hover:bg-slate-900 transition-all flex items-center gap-2"
                    >
                        {currentIdx === session.questions.length - 1 ? '完成测验' : '下一题'}
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default QuizInterface;