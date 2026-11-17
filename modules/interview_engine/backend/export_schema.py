"""Regenerate the shared schema from the server's validation models."""

import json

from .routes import CONTRACTS_DIR
from .schemas import InterviewSession


def main():
    schema = InterviewSession.model_json_schema()
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    (CONTRACTS_DIR / "interview.schema.json").write_text(
        json.dumps(schema, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
