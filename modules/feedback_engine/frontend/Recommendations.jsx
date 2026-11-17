import React from "react";

export default function Recommendations({ recommendations = [], role = "Candidate" }) {
  const starSteps = [
    { step: "S - Situation", desc: "Set the context and describe the specific scenario or challenge." },
    { step: "T - Task", desc: "Explain the exact goal or responsibility assigned to you." },
    { step: "A - Action", desc: "Detail the specific technical and interpersonal actions YOU took." },
    { step: "R - Result", desc: "Quantify the outcome, impact, or key learning achieved." }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800">Targeted Placement Recommendations</h3>
        <p className="text-sm text-slate-500">
          Personalized practice roadmap designed to bridge resume-to-job description gaps and boost placement interview readiness.
        </p>
      </div>

      {/* Actionable Recommendations List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>🚀</span> Customized Action Plan
        </h4>
        <div className="space-y-3">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3.5 hover:bg-slate-100/60 transition"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm text-slate-800 font-medium leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* STAR Framework Guide */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-lg font-bold">The STAR Behavioral Response Method</h4>
            <p className="text-xs text-indigo-200">
              Gold standard rubric for tackling behavioral and situational HR questions.
            </p>
          </div>
          <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wider">
            Rubric Framework
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {starSteps.map((s, i) => (
            <div key={i} className="bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
              <span className="font-bold text-sm text-indigo-300 block mb-1">{s.step}</span>
              <p className="text-xs text-slate-200 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Practice Drills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xl mb-2">⏱️</div>
          <h5 className="font-bold text-slate-800 text-sm mb-1">Timed Voice Rehearsal</h5>
          <p className="text-xs text-slate-500 leading-relaxed">
            Record 60-second elevator pitches focusing on keeping pace strictly within 120–150 words per minute.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xl mb-2">📊</div>
          <h5 className="font-bold text-slate-800 text-sm mb-1">Quantify Project Impact</h5>
          <p className="text-xs text-slate-500 leading-relaxed">
            Rewrite project bullet points with concrete metrics: e.g., "improved query efficiency by 30%" or "served 200+ users".
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xl mb-2">🤝</div>
          <h5 className="font-bold text-slate-800 text-sm mb-1">Teamwork Conflict Story</h5>
          <p className="text-xs text-slate-500 leading-relaxed">
            Prepare one specific narrative where a disagreement in a group project was resolved constructively.
          </p>
        </div>
      </div>
    </div>
  );
}
