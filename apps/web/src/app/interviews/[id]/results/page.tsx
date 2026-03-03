'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const [scoreCard, setScoreCard] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getInterview(id).catch(() => null),
      api.getScoreCard(id).catch(() => null),
      api.getReport(id).catch(() => null),
    ])
      .then(([interviewData, scoreData, reportData]) => {
        setInterview(interviewData);
        setScoreCard(scoreData);
        setReport(reportData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center">Đang tải kết quả...</div>;
  }

  const criterionScores = scoreCard?.criterionScores || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Kết quả phỏng vấn</h1>

      {/* Overall Score */}
      {scoreCard ? (
        <>
          <div className="bg-white rounded-xl border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Đánh giá tổng quan</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  scoreCard.recommendation === 'STRONG_YES' || scoreCard.recommendation === 'YES'
                    ? 'bg-green-100 text-green-800'
                    : scoreCard.recommendation === 'MAYBE'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {scoreCard.recommendation}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl font-bold text-primary-600">
                {scoreCard.overallScore.toFixed(1)}
              </div>
              <div className="text-slate-500">
                / {scoreCard.maxPossibleScore.toFixed(1)} điểm
              </div>
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all"
                  style={{
                    width: `${(scoreCard.overallScore / scoreCard.maxPossibleScore) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-green-700 mb-2">💪 Điểm mạnh</h3>
                <ul className="space-y-1">
                  {scoreCard.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700">• {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-red-700 mb-2">📝 Cần cải thiện</h3>
                <ul className="space-y-1">
                  {scoreCard.weaknesses.map((w: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700">• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Criterion Breakdown */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">Chi tiết đánh giá theo tiêu chí</h2>
            <div className="space-y-6">
              {criterionScores.map((cs: any, i: number) => (
                <div key={i} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{cs.criterionName}</h3>
                    <span className="text-sm font-bold text-primary-600">
                      {cs.score}/{cs.maxScore}
                    </span>
                  </div>
                  <div className="bg-slate-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full"
                      style={{ width: `${(cs.score / cs.maxScore) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm text-slate-600 mb-1">
                    <span className="font-medium">Bằng chứng:</span> &ldquo;{cs.evidence}&rdquo;
                  </div>
                  <div className="text-sm text-slate-500">
                    <span className="font-medium">Lý do:</span> {cs.reasoning}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6 text-center">
          <p className="text-amber-800">
            ⏳ Đang đánh giá... Kết quả sẽ có trong vài phút.
          </p>
        </div>
      )}

      {/* Report Download */}
      {report?.pdfUrl && (
        <div className="bg-white rounded-xl border p-6 mb-6 text-center">
          <h2 className="font-semibold text-lg mb-3">📄 Báo cáo PDF</h2>
          <a
            href={report.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Tải báo cáo PDF
          </a>
        </div>
      )}

      {/* Transcript */}
      {interview?.turns && interview.turns.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-lg mb-4">Transcript phỏng vấn</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {interview.turns.map((turn: any, i: number) => (
              <div
                key={i}
                className={`flex gap-3 p-3 rounded-lg ${
                  turn.speakerRole === 'AI' ? 'bg-blue-50' : 'bg-slate-50'
                }`}
              >
                <span className="text-lg">
                  {turn.speakerRole === 'AI' ? '🤖' : '👤'}
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">
                    {turn.speakerRole === 'AI' ? 'Phỏng vấn viên' : 'Ứng viên'}
                    {turn.e2eLatencyMs && (
                      <span className="ml-2 text-slate-400">
                        ({turn.e2eLatencyMs}ms e2e)
                      </span>
                    )}
                  </p>
                  <p className="text-sm">{turn.transcript}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 bg-slate-100 rounded-lg p-4">
        <p className="text-xs text-slate-500 text-center">
          Báo cáo này được tạo tự động bởi AI. Kết quả chỉ mang tính tham khảo và hỗ trợ
          quyết định. Nhà tuyển dụng cần xem xét độc lập trước khi đưa ra quyết định cuối cùng.
        </p>
      </div>
    </div>
  );
}
