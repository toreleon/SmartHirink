'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function NewInterviewPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [selectedRubric, setSelectedRubric] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenarioDetail, setScenarioDetail] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.listScenarios(), api.listCandidates()]).then(([s, c]) => {
      setScenarios(s.items);
      setCandidates(c.items);
    });
  }, []);

  useEffect(() => {
    if (selectedScenario) {
      api.getScenario(selectedScenario).then((s) => {
        setScenarioDetail(s);
        if (s.rubrics?.length > 0) {
          setSelectedRubric(s.rubrics[0].id);
        }
      });
    }
  }, [selectedScenario]);

  const handleCreate = async () => {
    if (!selectedScenario || !selectedRubric || !selectedCandidate) {
      alert('Vui lòng chọn đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      const interview = await api.createInterview({
        scenarioId: selectedScenario,
        rubricId: selectedRubric,
        candidateId: selectedCandidate,
      });
      router.push(`/interviews/${interview.id}`);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Tạo phỏng vấn mới</h1>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Kịch bản phỏng vấn
          </label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">-- Chọn kịch bản --</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.position} - {s.level})
              </option>
            ))}
          </select>
        </div>

        {scenarioDetail?.rubrics?.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rubric đánh giá</label>
            <select
              value={selectedRubric}
              onChange={(e) => setSelectedRubric(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {scenarioDetail.rubrics.map((r: any) => (
                <option key={r.id} value={r.id}>
                  Rubric ({r.criteria.length} tiêu chí)
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ứng viên</label>
          <select
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">-- Chọn ứng viên --</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.email})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !selectedScenario || !selectedCandidate}
          className="w-full py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Đang tạo...' : 'Tạo phỏng vấn'}
        </button>
      </div>
    </div>
  );
}
