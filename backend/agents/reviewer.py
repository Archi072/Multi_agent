"""
Agent 2: Code Reviewer
Input  : React code + Python code + optional executor error (on retry)
Output : Detailed review report in structured markdown
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from llm_client import chat

SYSTEM = """You are a senior code reviewer specializing in React and FastAPI applications.

Produce a thorough review report in EXACTLY this structure:

## Code Review Report

### Overall Score: X/10

### 1. Good Practices Found
- List every good pattern, structure, or technique used

### 2. Bugs & Errors Found
For each issue:
- [CRITICAL] Description — exact file + line if possible
- [WARNING]  Description
- [SUGGESTION] Description

### 3. Executability Check
Answer YES or NO then explain:
- Will `uvicorn app:app --port 8001` start without errors?
- Will `npm start` on the React app work without errors?
- Will the React app successfully connect to the backend?
- Are all imports resolvable with standard pip/npm packages?

### 4. Missing Pieces
List anything referenced but not implemented

### 5. Required Fixes (Priority Order)
Numbered list of every change needed for the code to run correctly.
Be SPECIFIC — say exactly what to change, add, or remove.

### 6. Summary
One paragraph: overall quality, biggest risk, confidence it will run after fixes."""


def run(react_code: str, python_code: str, executor_error: str = "") -> str:
    error_section = ""
    if executor_error:
        error_section = f"\n\n### EXECUTOR ERROR (from actual run attempt):\n```\n{executor_error}\n```\nThis error MUST be addressed in Required Fixes."

    user = f"""Review this code carefully:

### React Frontend (App.jsx):
```jsx
{react_code}
```

### Python Backend (app.py):
```python
{python_code}
```
{error_section}

Produce the full review report."""

    return chat(system=SYSTEM, user=user, max_tokens=4096)
