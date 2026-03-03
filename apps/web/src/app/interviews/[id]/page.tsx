'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// Dynamic import to avoid SSR issues with LiveKit
const InterviewRoom = dynamic(() => import('@/components/InterviewRoom'), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Đang tải phòng phỏng vấn...</div>,
});

export default function InterviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hydrate } = useAuthStore();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .getInterview(id)
      .then(setInterview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const role = user?.role === 'RECRUITER' ? 'recruiter' : 'candidate';
      const data = await api.getLiveKitToken(id, role as any);
      setToken(data.token);
      setRoomName(data.room);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    try {
      await api.startInterview(id);
      const updated = await api.getInterview(id);
      setInterview(updated);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Đang tải...</div>;
  }

  if (!interview) {
    return <div className="p-8 text-center text-red-600">Không tìm thấy phỏng vấn</div>;
  }

  // If we have a token, show the interview room
  if (token && roomName) {
    return (
      <InterviewRoom
        token={token}
        roomName={roomName}
        onSessionComplete={() => {
          router.push(`/interviews/${id}/results`);
        }}
      />
    );
  }

  // Otherwise show interview detail / pre-join screen
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="bg-white rounded-xl border p-6">
        <h1 className="text-2xl font-bold mb-4">
          {interview.scenario?.title || 'Phỏng vấn'}
        </h1>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Thông tin phỏng vấn</h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Vị trí</dt>
                <dd>{interview.scenario?.position}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Cấp độ</dt>
                <dd>{interview.scenario?.level}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                    {interview.phase}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Phòng LiveKit</dt>
                <dd className="font-mono text-xs">{interview.livekitRoom}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Ứng viên</h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Tên</dt>
                <dd>{interview.candidate?.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd>{interview.candidate?.email}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* AI Disclosure */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <p className="text-amber-800 text-sm">
            ⚠️ Cuộc phỏng vấn này được thực hiện bởi AI phỏng vấn viên. Nội dung được ghi âm
            và phiên âm tự động. Kết quả đánh giá chỉ mang tính hỗ trợ, không thay thế quyết
            định của nhà tuyển dụng.
          </p>
        </div>

        {/* Pre-join Checklist */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Chuẩn bị trước khi vào phỏng vấn</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>✅ Kiểm tra microphone đã hoạt động</li>
            <li>✅ Đảm bảo kết nối internet ổn định</li>
            <li>✅ Chọn nơi yên tĩnh để phỏng vấn</li>
            <li>✅ Sẵn sàng trả lời bằng tiếng Việt (có thể dùng thuật ngữ tiếng Anh)</li>
          </ul>
        </div>

        <div className="flex gap-3">
          {interview.phase === 'CREATED' && user?.role === 'RECRUITER' && (
            <button
              onClick={handleStart}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Bắt đầu phiên phỏng vấn
            </button>
          )}

          {(interview.phase === 'WAITING' || interview.phase === 'CREATED') && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {joining ? 'Đang kết nối...' : '🎙️ Tham gia phỏng vấn'}
            </button>
          )}

          {interview.phase === 'COMPLETED' && (
            <a
              href={`/interviews/${id}/results`}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              📊 Xem kết quả
            </a>
          )}
        </div>
      </div>

      {/* Transcript Preview (if available) */}
      {interview.turns && interview.turns.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-lg mb-4">Transcript</h2>
          <div className="space-y-3">
            {interview.turns.map((turn: any, i: number) => (
              <div key={i} className="flex gap-3">
                <span
                  className={`text-xs font-medium mt-1 ${
                    turn.speakerRole === 'AI' ? 'text-blue-600' : 'text-green-600'
                  }`}
                >
                  {turn.speakerRole === 'AI' ? '🤖' : '👤'}
                </span>
                <p className="text-sm text-slate-700">{turn.transcript}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
