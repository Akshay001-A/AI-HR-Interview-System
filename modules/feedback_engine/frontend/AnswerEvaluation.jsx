import React, { useState } from "react";

export default function AnswerEvaluation({ evaluations = [] }) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [showImproved, setShowImproved] = useState({});

  const toggleImproved = (idx) => {
    setShowImproved((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 65) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const getBarColor = (score) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 65) return "bg-amber-500";
    return "bg-rose-500";
  };

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        No evaluation data available. Run an interview evaluation to inspect answers.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Question-by-Question Rubric Evaluation</h3>
          <p className="text-sm text-slate-500">
            Assessed across 5 core criteria: Relevance, Clarity, Structure, Completeness, and Examples
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
          {evaluations.length} Questions Evaluated
        </span>
      </div>

      <div className="space-y-4">
        {evaluations.map((item, index) => {
          const isCurrent = expandedIndex === index;
          const criteria = item.criteria || {
            relevance: item.relevance || 75,
            clarity: item.clarity || 75,
            structure: item.structure || 70,
            completeness: item.completeness || 70,
            examples: item.examples || 70
          };

          return (
            <div
              key={item.question_id || index}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition hover:shadow-md"
            >
              {/* Question Header Bar */}
              <div
                onClick={() => setExpandedIndex(isCurrent ? -1 : index)}
                className="p-5 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/60"
              >
                <div className="flex items-start gap-3 max-w-[75%]">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                    Q{index + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-base">
                      {item.question || `Question ${index + 1}`}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 italic line-clamp-1">
                      "{item.answer || "No response recorded."}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-lg border font-bold text-sm ${getScoreColor(item.score)}`}>
                    Score: {item.score}/100
                  </div>
                  <span className="text-slate-400 text-sm">
                    {isCurrent ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown Panel */}
              {isCurrent && (
                <div className="p-6 border-t border-slate-100 space-y-6">
                  {/* Candidate Answer Box */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Candidate's Given Response
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {item.answer || "No response provided."}
                    </p>
                  </div>

                  {/* 5 Criteria Sliders */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                      Rubric Criteria Breakdown (0–100 Scale)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {[
                        { key: "relevance", label: "Relevance", val: criteria.relevance },
                        { key: "clarity", label: "Clarity", val: criteria.clarity },
                        { key: "structure", label: "Structure", val: criteria.structure },
                        { key: "completeness", label: "Completeness", val: criteria.completeness },
                        { key: "examples", label: "Examples", val: criteria.examples }
                      ].map((crit) => (
                        <div key={crit.key} className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-slate-600">{crit.label}</span>
                            <span className="text-xs font-bold text-slate-800">{crit.val}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${getBarColor(crit.val)}`}
                              style={{ width: `${crit.val}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                      <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="text-emerald-600 font-bold">✓</span> Key Strengths
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {(item.strengths || ["Clearly formulated initial thought"]).map((st, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">•</span>
                            <span>{st}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Areas for Improvement */}
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
                      <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="text-amber-600 font-bold">!</span> Areas to Refine
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {(item.weaknesses || ["Expand with specific project outcomes"]).map((wk, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{wk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* AI Improved Sample Answer */}
                  {item.improved_answer && (
                    <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                          <span>✨</span> AI-Recommended Model Answer
                        </span>
                        <button
                          onClick={() => toggleImproved(index)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                        >
                          {showImproved[index] ? "Collapse Model Answer" : "Show Full Model Answer"}
                        </button>
                      </div>

                      {showImproved[index] && (
                        <p className="text-sm text-slate-700 mt-2 bg-white p-3 rounded-lg border border-indigo-100 leading-relaxed">
                          {item.improved_answer}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
