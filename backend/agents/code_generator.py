"""
Agent 1: Code Generator
Input  : BRD + TDD documents extracted from ZIP
Output : React (App.jsx) + FastAPI (app.py) code as raw string with code blocks
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from llm_client import chat

SYSTEM = """You are a senior full-stack engineer.
Generate complete, production-ready code from the given BRD and TDD documents.

OUTPUT FORMAT — return EXACTLY these two fenced code blocks, nothing else:

```jsx
// Complete React App.jsx here
```

```python
# Complete FastAPI app.py here
```

REACT RULES:
- Single file App.jsx, functional components + hooks only
- Fetch all data from http://localhost:8001 (NOT 8000)
- Handle loading states and errors
- No missing imports, fully self-contained

PYTHON RULES:
- Single file app.py using FastAPI
- CORS must allow http://localhost:3001 AND http://localhost:3000
- Run with: uvicorn app:app --host 0.0.0.0 --port 8001 --reload
- Use in-memory data structures (no database needed unless TDD says so)
- Include sample seed data so the app works immediately

Do NOT explain. Output ONLY the two code blocks."""


def run(documents: dict) -> str:
    docs = "\n\n".join(f"=== {name} ===\n{content}" for name, content in documents.items())
    user = f"Generate the React frontend and FastAPI backend for these documents:\n\n{docs}"
    return chat(system=SYSTEM, user=user, max_tokens=8192)
