'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function InterviewsListPage() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listInterviews({ limit: 50 })
      .then((data) => setInterviews(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Danh sách phỏng vấn</h1>
        <a
          href="/interviews/new"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + Tạo mới
        </a>
      </div>

      {loading ? (
        <p className="text-center text-slate-500">Đang tải...</p>
      ) : interviews.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-slate-500 mb-4">Chưa có phỏng vấn nào</p>
          <a href="/interviews/new" className="text-primary-600 hover:underline">
            Tạo phỏng vấn đầu tiên
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {interviews.map((i) => (
            <a
              key={i.id}
              href={`/interviews/${i.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium">{i.scenario?.title || 'Phỏng vấn'}</p>
                <p className="text-sm text-slate-500">
                  {i.candidate?.fullName} • {i.scenario?.position} ({i.scenario?.level})
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    i.phase === 'COMPLETED'
                      ? 'bg-green-100 text-green-700'
                      : i.phase === 'CANCELLED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {i.phase}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(i.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
