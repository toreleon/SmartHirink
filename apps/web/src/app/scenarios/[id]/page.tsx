'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function ScenarioDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [scenario, setScenario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRubricForm, setShowRubricForm] = useState(false);
  const [criteria, setCriteria] = useState([
    { name: '', description: '', maxScore: 10, weight: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.getScenario(id).then(setScenario).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const addCriterion = () => {
    setCriteria([...criteria, { name: '', description: '', maxScore: 10, weight: 1 }]);
  };

  const updateCriterion = (i: number, field: string, value: any) => {
    const next = [...criteria];
    (next[i] as any)[field] = value;
    setCriteria(next);
  };

  const removeCriterion = (i: number) => {
    setCriteria(criteria.filter((_, idx) => idx !== i));
  };

  const handleCreateRubric = async () => {
    setSaving(true);
    try {
      await api.createRubric(id, { criteria });
      setShowRubricForm(false);
      setCriteria([{ name: '', description: '', maxScore: 10, weight: 1 }]);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;
  if (!scenario) return <div className="p-8 text-center text-red-600">Không tìm thấy</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">{scenario.title}</h1>
        <p className="text-slate-600 mb-4">{scenario.position} • {scenario.level}</p>

        {scenario.topics?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {scenario.topics.map((t: string, i: number) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded">
                {t}
              </span>
            ))}
          </div>
        )}

        {scenario.systemContext && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
            {scenario.systemContext}
          </div>
        )}
      </div>

      {/* Rubrics */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Rubrics đánh giá</h2>
        <button
          onClick={() => setShowRubricForm(!showRubricForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm"
        >
          {showRubricForm ? 'Đóng' : '+ Tạo rubric'}
        </button>
      </div>

      {showRubricForm && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h3 className="font-semibold mb-4">Tạo Rubric mới</h3>
          <div className="space-y-4">
            {criteria.map((c, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Tiêu chí #{i + 1}</span>
                  {criteria.length > 1 && (
                    <button
                      onClick={() => removeCriterion(i)}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    value={c.name}
                    onChange={(e) => updateCriterion(i, 'name', e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm"
                    placeholder="Tên tiêu chí"
                  />
                  <input
                    value={c.description}
                    onChange={(e) => updateCriterion(i, 'description', e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm"
                    placeholder="Mô tả"
                  />
                  <input
                    type="number"
                    value={c.maxScore}
                    onChange={(e) => updateCriterion(i, 'maxScore', parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm"
                    placeholder="Điểm tối đa"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={c.weight}
                    onChange={(e) => updateCriterion(i, 'weight', parseFloat(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm"
                    placeholder="Trọng số"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={addCriterion}
              className="text-sm text-primary-600 hover:underline"
            >
              + Thêm tiêu chí
            </button>
            <div className="flex-1" />
            <button
              onClick={handleCreateRubric}
              disabled={saving || criteria.some((c) => !c.name)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Đang tạo...' : 'Lưu rubric'}
            </button>
          </div>
        </div>
      )}

      {scenario.rubrics?.length > 0 ? (
        <div className="space-y-4">
          {scenario.rubrics.map((r: any, ri: number) => (
            <div key={r.id} className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Rubric #{ri + 1}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2">Tiêu chí</th>
                    <th className="pb-2">Mô tả</th>
                    <th className="pb-2 text-center">Điểm tối đa</th>
                    <th className="pb-2 text-center">Trọng số</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.criteria.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2 text-slate-600">{c.description}</td>
                      <td className="py-2 text-center">{c.maxScore}</td>
                      <td className="py-2 text-center">{c.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          Chưa có rubric nào. Tạo rubric để bắt đầu đánh giá ứng viên.
        </div>
      )}
    </div>
  );
}
