import React from "react";

export default function CommunicationAnalysis({ communicationData = {} }) {
  const {
    overall_clarity = 80,
    filler_words_detected = [],
    filler_word_count = 0,
    filler_breakdown = {},
    grammar_score = 85,
    grammar_notes = [],
    speaking_metrics = null
  } = communicationData;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800">Communication & Speech Analysis</h3>
        <p className="text-sm text-slate-500">
          NLP speech evaluation of verbal clarity, grammar precision, filler word frequencies, and speaking pace.
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Clarity Score Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Verbal Clarity
            </span>
            <span className="text-xl">🎙️</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">{overall_clarity}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${overall_clarity}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Assesses vocabulary structure, sentence completeness, and message flow.
          </p>
        </div>

        {/* Grammar & Fluency Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Grammar & Flow
            </span>
            <span className="text-xl">✍️</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">{grammar_score}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
            <div
              className="bg-emerald-500 h-2 rounded-full"
              style={{ width: `${grammar_score}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Evaluates syntax, coherence, and professional phrasing.
          </p>
        </div>

        {/* Filler Word Density Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Filler Word Count
            </span>
            <span className="text-xl">🗣️</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${filler_word_count > 4 ? "text-amber-600" : "text-emerald-600"}`}>
              {filler_word_count}
            </span>
            <span className="text-xs text-slate-400">occurrences</span>
          </div>
          <div className="mt-3">
            {filler_word_count === 0 ? (
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                Zero filler words detected
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
                {filler_words_detected.length} distinct filler types
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Identifies hesitation markers like "um", "uh", "like", and "you know".
          </p>
        </div>
      </div>

      {/* Speaking Metrics (Voice Timing) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>⏱️</span> Speaking Pace & Timing Metrics
        </h4>

        {speaking_metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Speaking Rate</span>
              <div className="text-2xl font-bold text-indigo-700 mt-1">
                {speaking_metrics.words_per_minute} <span className="text-xs text-slate-500">WPM</span>
              </div>
              <span className="text-xs text-slate-400">Target: 120–150 WPM</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Total Duration</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {speaking_metrics.duration_seconds}s
              </div>
              <span className="text-xs text-slate-400">Elapsed answer time</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Words Spoken</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {speaking_metrics.words_spoken}
              </div>
              <span className="text-xs text-slate-400">Total vocabulary size</span>
            </div>

            <div className="bg-indigo-50/60 p-4 rounded-lg border border-indigo-200">
              <span className="text-xs font-semibold text-indigo-900">Pace Assessment</span>
              <p className="text-xs text-slate-700 mt-1.5 leading-snug">
                {speaking_metrics.pace_evaluation}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 flex items-center gap-2">
            <span>ℹ️</span> Speaking-rate metrics omitted as speech timing was not recorded for this session.
          </div>
        )}
      </div>

      {/* Filler Words Breakdown & Grammar Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Filler Words Cloud */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Detected Filler Word Distribution
          </h4>
          {filler_words_detected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filler_words_detected.map((filler) => {
                const count = filler_breakdown[filler] || 1;
                return (
                  <span
                    key={filler}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold"
                  >
                    <span>"{filler}"</span>
                    <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px]">
                      {count}x
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No verbal fillers recorded. Excellent conversational composure!
            </p>
          )}
        </div>

        {/* Grammar & Articulation Notes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Grammar & Phrasing Observations
          </h4>
          <ul className="space-y-2 text-xs text-slate-700">
            {grammar_notes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-indigo-500 font-bold">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
