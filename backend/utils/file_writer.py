import os
import re

# Intermediate save dir (for reference / debugging)
OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "output")
)


def write_generated_files(react_code: str, python_code: str) -> dict:
    """Save corrected files to output/ for reference. Executor writes its own copy."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    written = {}

    if react_code and react_code.strip():
        p = os.path.join(OUTPUT_DIR, "App.jsx")
        with open(p, "w", encoding="utf-8") as f:
            f.write(react_code)
        written["react"] = os.path.abspath(p)

    if python_code and python_code.strip():
        p = os.path.join(OUTPUT_DIR, "app.py")
        with open(p, "w", encoding="utf-8") as f:
            f.write(python_code)
        written["python"] = os.path.abspath(p)

    return written


def extract_code_blocks(text: str) -> dict:
    """
    Parse ```jsx / ```javascript / ```tsx and ```python blocks from LLM output.
    Falls back to first generic ``` block if specific language not found.
    """
    result = {"react": "", "python": ""}

    # React block
    jsx = re.search(
        r"```(?:jsx|javascript|tsx|react|js)\s*\n(.*?)```",
        text, re.DOTALL | re.IGNORECASE
    )
    if jsx:
        result["react"] = jsx.group(1).strip()

    # Python block
    py = re.search(r"```python\s*\n(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if py:
        result["python"] = py.group(1).strip()

    # Fallback: if LLM used generic ``` blocks, grab first two
    if not result["react"] or not result["python"]:
        generic = re.findall(r"```\s*\n(.*?)```", text, re.DOTALL)
        if len(generic) >= 1 and not result["react"]:
            result["react"] = generic[0].strip()
        if len(generic) >= 2 and not result["python"]:
            result["python"] = generic[1].strip()

    return result
