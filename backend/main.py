"""
main.py — AgentForge pipeline server
Pipeline: extract → generate → [review → correct → execute] loop (max 3 retries)
Streams progress via Server-Sent Events (SSE).
"""
import os
import asyncio
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv()

from agents import code_generator, reviewer, corrector, executor
from utils.zip_extractor import extract_documents_from_zip
from utils.file_writer import extract_code_blocks, write_generated_files

MAX_RETRIES = 3

app = FastAPI(title="AgentForge Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/generate")
async def generate(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(400, "Only ZIP files accepted.")

    zip_bytes = await file.read()

    async def pipeline():
        try:
            # ── STEP 1: Extract documents ──────────────────────────────────
            yield sse("progress", {"step": 1, "agent": "extractor", "status": "running",
                                   "message": "Extracting documents from ZIP..."})
            await asyncio.sleep(0.05)

            documents = await asyncio.to_thread(extract_documents_from_zip, zip_bytes)
            if not documents:
                yield sse("error", {"message": "No readable documents found in the ZIP."})
                return

            yield sse("progress", {"step": 1, "agent": "extractor", "status": "done",
                                   "message": f"Extracted: {', '.join(documents.keys())}"})

            # ── STEP 2: Agent 1 — Code Generator ──────────────────────────
            yield sse("progress", {"step": 2, "agent": "code_generator", "status": "running",
                                   "message": "Agent 1 → Generating React + FastAPI code from documents..."})

            raw = await asyncio.to_thread(code_generator.run, documents)
            generated = extract_code_blocks(raw)

            if not generated["react"] or not generated["python"]:
                yield sse("error", {"message": "Code Generator did not return both React and Python blocks."})
                return

            yield sse("progress", {"step": 2, "agent": "code_generator", "status": "done",
                                   "message": "Agent 1 → Code generation complete.",
                                   "react_code": generated["react"],
                                   "python_code": generated["python"]})

            # ── RETRY LOOP: Review → Correct → Execute ─────────────────────
            current_react  = generated["react"]
            current_python = generated["python"]
            executor_error = ""
            final_result   = None

            for attempt in range(1, MAX_RETRIES + 1):
                attempt_label = f"(Attempt {attempt}/{MAX_RETRIES})"

                # ── STEP 3: Agent 2 — Reviewer ─────────────────────────────
                yield sse("progress", {"step": 3, "agent": "reviewer", "status": "running",
                                       "message": f"Agent 2 → Reviewing code... {attempt_label}",
                                       "attempt": attempt})

                review_report = await asyncio.to_thread(
                    reviewer.run, current_react, current_python, executor_error
                )

                yield sse("progress", {"step": 3, "agent": "reviewer", "status": "done",
                                       "message": f"Agent 2 → Review complete. {attempt_label}",
                                       "report": review_report, "attempt": attempt})

                # ── STEP 4: Agent 3 — Corrector ────────────────────────────
                yield sse("progress", {"step": 4, "agent": "corrector", "status": "running",
                                       "message": f"Agent 3 → Correcting code based on review... {attempt_label}",
                                       "attempt": attempt})

                raw_corrected = await asyncio.to_thread(
                    corrector.run, current_react, current_python, review_report
                )
                corrected = extract_code_blocks(raw_corrected)

                # Fall back to current if corrector returned empty
                if not corrected["react"]:  corrected["react"]  = current_react
                if not corrected["python"]: corrected["python"] = current_python

                current_react  = corrected["react"]
                current_python = corrected["python"]

                yield sse("progress", {"step": 4, "agent": "corrector", "status": "done",
                                       "message": f"Agent 3 → Correction complete. {attempt_label}",
                                       "react_code": current_react,
                                       "python_code": current_python,
                                       "attempt": attempt})

                # Save corrected files to disk
                await asyncio.to_thread(write_generated_files, current_react, current_python)

                # ── STEP 5: Agent 4 — Executor ─────────────────────────────
                yield sse("progress", {"step": 5, "agent": "executor", "status": "running",
                                       "message": f"Agent 4 → Installing packages + launching app... {attempt_label}",
                                       "attempt": attempt})

                success, error, pids = await asyncio.to_thread(
                    executor.run, current_react, current_python
                )

                if success:
                    yield sse("progress", {"step": 5, "agent": "executor", "status": "done",
                                           "message": f"Agent 4 → App is live! {attempt_label}",
                                           "attempt": attempt,
                                           "backend_url": pids.get("backend_url"),
                                           "frontend_url": pids.get("frontend_url")})

                    final_result = {
                        "react_code":    current_react,
                        "python_code":   current_python,
                        "report":        review_report,
                        "attempt":       attempt,
                        "backend_url":   pids.get("backend_url"),
                        "frontend_url":  pids.get("frontend_url"),
                    }
                    break  # ← success, exit retry loop

                else:
                    executor_error = error
                    if attempt < MAX_RETRIES:
                        yield sse("progress", {"step": 5, "agent": "executor", "status": "failed",
                                               "message": f"Agent 4 → Execution failed. Looping back to reviewer... {attempt_label}",
                                               "error": error[:500],
                                               "attempt": attempt})
                    else:
                        yield sse("progress", {"step": 5, "agent": "executor", "status": "failed",
                                               "message": f"Agent 4 → Failed after {MAX_RETRIES} attempts.",
                                               "error": error[:500],
                                               "attempt": attempt})

            # ── Final result ───────────────────────────────────────────────
            if final_result:
                yield sse("done", {
                    "message": f"Pipeline complete! App running on attempt {final_result['attempt']}.",
                    **final_result
                })
            else:
                yield sse("done", {
                    "message": f"Pipeline finished but app could not be executed after {MAX_RETRIES} attempts.",
                    "react_code":  current_react,
                    "python_code": current_python,
                    "report":      review_report,
                    "attempt":     MAX_RETRIES,
                    "execution_failed": True,
                })

        except Exception as e:
            import traceback
            yield sse("error", {"message": str(e), "trace": traceback.format_exc()[-1000:]})

    return StreamingResponse(
        pipeline(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
