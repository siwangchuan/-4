import React, { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';

interface UploadSectionProps {
  onGenerate: (files: {data: string, type: string, name: string}[], config: {topic: string, difficulty: string, count: number}) => void;
  isLoading: boolean;
}

const UploadSection: React.FC<UploadSectionProps> = ({ onGenerate, isLoading }) => {
  const [files, setFiles] = useState<{name: string, type: string, data: string}[]>([]);
  const [topic, setTopic] = useState('数据结构');
  const [difficulty, setDifficulty] = useState('中等');
  const [count, setCount] = useState(5);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          setFiles(prev => [...prev, {
            name: file.name,
            type: file.type,
            data: base64String
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  }, []);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStart = () => {
    onGenerate(files, { topic, difficulty, count });
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">配置您的学习会话</h2>
      
      <div className="space-y-6">
        {/* File Upload Area */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 hover:bg-slate-50 transition-colors text-center">
            <input 
                type="file" 
                id="file-upload" 
                multiple 
                className="hidden" 
                accept=".pdf,.txt,.md,.png,.jpg"
                onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                    <Upload size={24} />
                </div>
                <p className="font-medium text-slate-700">点击上传教学大纲、历年试题或笔记</p>
                <p className="text-sm text-slate-400 mt-1">支持 PDF, 图片 (PNG/JPG), 文本 (TXT/MD)</p>
            </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
            <div className="space-y-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3">
                            <FileText size={18} className="text-slate-500" />
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{f.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                            <X size={18} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* Configurations */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">科目 / 主题</label>
                <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="例如：操作系统"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">难度</label>
                <select 
                    value={difficulty} 
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    <option value="Easy">简单</option>
                    <option value="Medium">中等</option>
                    <option value="Hard">困难</option>
                    <option value="Expert">专家</option>
                </select>
            </div>
        </div>

        <div>
             <label className="block text-sm font-medium text-slate-600 mb-2">题目数量: {count}</label>
             <input 
                type="range" 
                min="1" 
                max="20" 
                value={count} 
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
             />
        </div>

        <button 
            onClick={handleStart}
            disabled={isLoading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
        >
            {isLoading ? (
                <>
                    <Loader2 className="animate-spin" /> 正在生成测验...
                </>
            ) : (
                '生成智能测验'
            )}
        </button>
      </div>
    </div>
  );
};

export default UploadSection;