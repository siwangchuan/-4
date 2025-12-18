import React from 'react';
import { UserStats } from '../types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BookOpen, Target, TrendingUp, BrainCircuit } from 'lucide-react';

interface DashboardProps {
  stats: UserStats;
  onStartNew: () => void;
  onViewPlan: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onStartNew, onViewPlan }) => {
  const radarData = Object.keys(stats.topicStrength).map(key => ({
    subject: key,
    A: stats.topicStrength[key],
    fullMark: 100,
  }));

  const lineData = stats.recentActivity.map((act, idx) => ({
    name: `测验 ${idx + 1}`,
    score: act.score
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">测验总数</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.totalQuizzes}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <Target size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">平均分</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.averageScore.toFixed(0)}%</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">进步幅度</p>
            <h3 className="text-2xl font-bold text-slate-800">+12%</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">薄弱环节</p>
            <h3 className="text-lg font-semibold text-slate-800 truncate max-w-[120px]" title={stats.weakPoints[0] || '无'}>
              {stats.weakPoints[0] || '无'}
            </h3>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">知识图谱</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="能力值" dataKey="A" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">学习曲线</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button 
          onClick={onStartNew}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.01]"
        >
          开始新测验
        </button>
        <button 
          onClick={onViewPlan}
          className="flex-1 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 py-4 rounded-xl font-semibold transition-all"
        >
          查看学习计划
        </button>
      </div>
    </div>
  );
};

export default Dashboard;