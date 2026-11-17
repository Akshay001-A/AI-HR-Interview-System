# Shared contracts

`interview.json` is the legacy synthetic interview fixture used by regression tests.
It is not an automatic demo mode. The feedback API also accepts the version 1.0
completed interview exported by Akshay's module.

`interview.schema.json` describes the standalone interview output.
`feedback-input.schema.json` describes the normalized completed session returned by
`POST /api/feedback/validate`. The input normalizer may derive missing question text,
questions and primary count from the documented older format before validation.

`feedback.schema.json` describes reports returned by evaluation and retrieval.
Feedback reports use version 2.0, with validated Gemini criteria, source metadata,
text-only statistics and explicit `storage.saved`. There are no substitute scores
when Gemini fails. Criteria and answer/overall scores use integers from 0 to 100.
An answer template is a suggestion with placeholders, never invented experience.

The old `feedback.json` demo response is obsolete and has been removed. Runtime
reports come from the API, and the UI validates their version and required fields.
