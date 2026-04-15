"""
Agent 3: Code Corrector
Input  : Original React code + Python code + Review report
Output : Fully corrected React + Python code as raw string with code blocks
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from llm_client import chat

SYSTEM = """You are a senior engineer who fixes code based on review reports.

Fix ALL issues marked [CRITICAL] and [WARNING] in the review.
Keep all working functionality intact.

OUTPUT FORMAT — return EXACTLY these two fenced code blocks, nothing else:

```jsx
// Complete corrected React App.jsx here
```

```python
# Complete corrected FastAPI app.py here
```

HARD REQUIREMENTS after fixing:
- React fetches from http://localhost:8001
- FastAPI has CORS for http://localhost:3001 AND http://localhost:3000
- FastAPI runs on port 8001
- All imports must exist in standard pip/npm packages
- App must work end-to-end with no manual setup

Do NOT explain. Output ONLY the two corrected code blocks."""


def run(react_code: str, python_code: str, review_report: str) -> str:
    user = f"""Fix this code using the review report:

### Current React (App.jsx):
```jsx
{react_code}
```

### Current Python (app.py):
```python
{python_code}
```

### Review Report (fix everything marked CRITICAL and WARNING):
{review_report}

Output the two corrected files."""

    return chat(system=SYSTEM, user=user, max_tokens=8192)
