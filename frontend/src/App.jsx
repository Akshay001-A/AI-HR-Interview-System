import React, { useState } from "react";
import FeedbackApp from "../../modules/feedback_engine/frontend/FeedbackApp";

// Akshay's module can be imported dynamically or once merged
let InterviewApp = null;
try {
  InterviewApp = require("../../modules/interview_engine/frontend/InterviewApp").default;
} catch (e) {
  // Interview engine not yet merged
}

export default function App() {
  const [interviewData, setInterviewData] = useState(null);

  if (interviewData) {
    return <FeedbackApp interviewData={interviewData} />;
  }

  if (InterviewApp) {
    return <InterviewApp onComplete={setInterviewData} />;
  }

  // Standalone mode for Charan's Feedback Engine
  return <FeedbackApp interviewData={null} />;
}
