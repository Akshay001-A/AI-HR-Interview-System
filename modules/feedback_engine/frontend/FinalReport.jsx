import React from "react";

export default function FinalReport({ reportData = {} }) {
  const {
    session_id = "session_001",
    role = "Software Developer",
    category = "HR",
    difficulty = "Beginner",
    overall_score = 76,
    evaluations = [],
    recommendations = [],
    storage_engine = "mongodb",
    created_at = new Date().toISOString()
  } = reportData;

  const getScoreVerdict = (score) => {
    if (score >= 85) return { label: "Exceptional Readiness", color: "text-emerald-700 bg-emerald-50 border-emerald-300" };
    if (score >= 70) return { label: "Good Placement Readiness", color: "text-indigo-700 bg-indigo-50 border-indigo-300" };
    if (score >= 55) return { label: "Moderate – Needs Practice", color: "text-amber-700 bg-amber-50 border-amber-300" };
    return { label: "Requires Targeted Preparation", color: "text-rose-700 bg-rose-50 border-rose-300" };
  };

  const verdict = getScoreVerdict(overall_score);

  // Compute criteria averages
  const criteriaKeys = ["relevance", "clarity", "structure", "completeness", "examples"];
  const criteriaLabels = {
    relevance: "Relevance",
    clarity: "Clarity",
    structure: "Structure",
    completeness: "Completeness",
    examples: "Examples"
  };

  const avgCriteria = {};
  criteriaKeys.forEach((key) => {
    if (evaluations.length > 0) {
      const sum = evaluations.reduce((acc, item) => {
        const c = item.criteria || {};
        return acc + (c[key] || item[key] || 70);
      }, 0);
      avgCriteria[key] = Math.round(sum / evaluations.length);
    } else {
      avgCriteria[key] = 75;
    }
  });

  return (
    <div className="space-y-6">
      {/* Session Metadata Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Session #{session_id}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              {storage_engine === "mongodb" ? "MongoDB Atlas Synced" : "Locally Cached"}
            </span>
          </div>
          <h2 className="text-2xl font-bold">{role} Interview Evaluation Report</h2>
          <p className="text-slate-400 text-xs mt-1">
            Category: {category} · Level: {difficulty} · Generated: {new Date(created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            🖨️ Print / Export
          </button>
        </div>
      </div>

      {/* Hero Performance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Score Dial */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Cumulative Score
          </span>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-indigo-600"
                strokeDasharray={`${overall_score}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-slate-800">{overall_score}</span>
              <span className="text-[10px] text-slate-400 font-medium">OUT OF 100</span>
            </div>
          </div>
          <div className={`mt-4 px-3 py-1 rounded-full border text-xs font-bold ${verdict.color}`}>
            {verdict.label}
          </div>
        </div>

        {/* 5 Criteria Bar Visualizer */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm md:col-span-2">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
            Rubric Criteria Competency Profile
          </h4>
          <div className="space-y-3.5">
            {criteriaKeys.map((key) => {
              const val = avgCriteria[key] || 70;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>{criteriaLabels[key]}</span>
                    <span className="font-bold">{val}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question Score Distribution Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
          Per-Question Score Comparison
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {evaluations.map((item, idx) => (
            <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
              <span className="text-xs text-slate-500 font-semibold">Q{idx + 1}</span>
              <div className="text-2xl font-black text-slate-800 my-1">{item.score}</div>
              <div className="text-[10px] text-slate-400 truncate" title={item.question}>
                {item.question || `Question ${idx + 1}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Summary of Top Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5">
          <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>🎯</span> Primary Placement Action Items
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
