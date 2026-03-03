'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', position: '', level: 'JUNIOR', systemContext: '', topics: '' });
  const [saving, setSaving] = useState(false);

  const loadScenarios = () => {
    api.listScenarios().then((d) => { setScenarios(d.items); setLoading(false); });
  };

  useEffect(loadScenarios, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.createScenario({
        ...form,
        topics: form.topics.split(',').map((t: string) => t.trim()).filter(Boolean),
      });
      setShowForm(false);
      setForm({ title: '', position: '', level: 'JUNIOR', systemContext: '', topics: '' });
      loadScenarios();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Kịch bản phỏng vấn</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {showForm ? 'Đóng' : '+ Tạo kịch bản'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tiêu đề</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="VD: Backend Developer Interview"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vị trí</label>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="VD: Backend Developer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cấp độ</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="INTERN">Intern</option>
                <option value="JUNIOR">Junior</option>
                <option value="MID">Mid</option>
                <option value="SENIOR">Senior</option>
                <option value="LEAD">Lead</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Các chủ đề (phân cách bởi dấu phẩy)</label>
            <input
              value={form.topics}
              onChange={(e) => setForm({ ...form, topics: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="VD: Node.js, TypeScript, System Design"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ngữ cảnh hệ thống (tùy chọn)</label>
            <textarea
              value={form.systemContext}
              onChange={(e) => setForm({ ...form, systemContext: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Thêm ngữ cảnh cho AI phỏng vấn viên..."
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !form.title || !form.position}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Đang tạo...' : 'Tạo kịch bản'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-slate-500">Đang tải...</p>
      ) : scenarios.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-slate-500">
          Chưa có kịch bản nào
        </div>
      ) : (
        <div className="space-y-4">
          {scenarios.map((s) => (
            <a
              key={s.id}
              href={`/scenarios/${s.id}`}
              className="block bg-white rounded-xl border p-6 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <span className="text-xs px-2 py-1 bg-slate-100 rounded">{s.level}</span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{s.position}</p>
              {s.topics?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.topics.map((t: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
