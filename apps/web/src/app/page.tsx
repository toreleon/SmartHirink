export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          SmartHirink
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          Nền tảng phỏng vấn ảo AI thông minh cho tuyển dụng IT
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Đăng nhập
          </a>
          <a
            href="/register"
            className="px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition"
          >
            Đăng ký
          </a>
        </div>
      </div>

      <div className="mt-16 grid md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="text-2xl mb-3">🎙️</div>
          <h3 className="font-semibold text-lg mb-2">Phỏng vấn Real-time</h3>
          <p className="text-slate-600 text-sm">
            Trao đổi trực tiếp bằng giọng nói với AI phỏng vấn viên qua công nghệ WebRTC.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="text-2xl mb-3">📊</div>
          <h3 className="font-semibold text-lg mb-2">Đánh giá Thông minh</h3>
          <p className="text-slate-600 text-sm">
            AI tự động chấm điểm theo rubric với bằng chứng cụ thể từ transcript.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="text-2xl mb-3">📋</div>
          <h3 className="font-semibold text-lg mb-2">Báo cáo Chi tiết</h3>
          <p className="text-slate-600 text-sm">
            Xuất báo cáo PDF đầy đủ với điểm mạnh, điểm yếu, và khuyến nghị.
          </p>
        </div>
      </div>

      <div className="mt-12 bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
        <p className="text-amber-800 text-sm">
          ⚠️ Lưu ý: Hệ thống sử dụng AI để hỗ trợ đánh giá. Kết quả chỉ mang tính tham khảo,
          quyết định tuyển dụng cuối cùng thuộc về nhà tuyển dụng.
        </p>
      </div>
    </div>
  );
}
