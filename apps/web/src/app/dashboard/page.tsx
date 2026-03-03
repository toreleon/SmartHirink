'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function DashboardPage() {
  const { user, hydrate } = useAuthStore();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .listInterviews({ limit: 10 })
      .then((data) => setInterviews(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-slate-600">
          Vui lòng <a href="/login" className="text-primary-600 underline">đăng nhập</a> để tiếp tục.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">
            Xin chào, {user.fullName} ({user.role === 'RECRUITER' ? 'Nhà tuyển dụng' : 'Ứng viên'})
          </p>
        </div>
        {user.role === 'RECRUITER' && (
          <a
            href="/interviews/new"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            + Tạo phỏng vấn mới
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-sm text-slate-500">Tổng phỏng vấn</p>
          <p className="text-2xl font-bold text-slate-900">{interviews.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-sm text-slate-500">Đang chờ</p>
          <p className="text-2xl font-bold text-amber-600">
            {interviews.filter((i) => i.phase === 'WAITING' || i.phase === 'CREATED').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-sm text-slate-500">Hoàn thành</p>
          <p className="text-2xl font-bold text-green-600">
            {interviews.filter((i) => i.phase === 'COMPLETED').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-sm text-slate-500">Đang diễn ra</p>
          <p className="text-2xl font-bold text-blue-600">
            {interviews.filter((i) => ['INTRO', 'QUESTIONING', 'WRAP_UP'].includes(i.phase)).length}
          </p>
        </div>
      </div>

      {/* Interview List */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-lg">Phỏng vấn gần đây</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-500">Đang tải...</div>
        ) : interviews.length === 0 ? (
          <div className="p-6 text-center text-slate-500">Chưa có phỏng vấn nào</div>
        ) : (
          <div className="divide-y">
            {interviews.map((interview) => (
              <a
                key={interview.id}
                href={`/interviews/${interview.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {interview.scenario?.title || 'Phỏng vấn'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {interview.candidate?.fullName} • {interview.scenario?.position}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      interview.phase === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : interview.phase === 'CANCELLED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {interview.phase}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(interview.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
