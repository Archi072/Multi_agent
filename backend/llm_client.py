"""
llm_client.py — Central LLM provider switcher
Set LLM_PROVIDER in .env: groq | gemini | anthropic
"""
import os

PROVIDER = os.getenv("LLM_PROVIDER", "groq").strip().lower()

MODELS = {
    "groq":      os.getenv("GROQ_MODEL",      "llama-3.3-70b-versatile"),
    "gemini":    os.getenv("GEMINI_MODEL",    "gemini-2.0-flash"),
    "anthropic": os.getenv("ANTHROPIC_MODEL", "claude-opus-4-5"),
}


def chat(system: str, user: str, max_tokens: int = 8192) -> str:
    if PROVIDER == "groq":
        return _groq(system, user, max_tokens)
    elif PROVIDER == "gemini":
        return _gemini(system, user, max_tokens)
    elif PROVIDER == "anthropic":
        return _anthropic(system, user, max_tokens)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER='{PROVIDER}'. Choose: groq | gemini | anthropic")


def _groq(system, user, max_tokens):
    from groq import Groq
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise EnvironmentError("GROQ_API_KEY not set in .env")
    client = Groq(api_key=key)
    resp = client.chat.completions.create(
        model=MODELS["groq"],
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return resp.choices[0].message.content


def _gemini(system, user, max_tokens):
    import google.generativeai as genai
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise EnvironmentError("GEMINI_API_KEY not set in .env")
    genai.configure(api_key=key)
    model = genai.GenerativeModel(
        model_name=MODELS["gemini"],
        system_instruction=system,
        generation_config={"max_output_tokens": max_tokens},
    )
    return model.generate_content(user).text


def _anthropic(system, user, max_tokens):
    import anthropic
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise EnvironmentError("ANTHROPIC_API_KEY not set in .env")
    client = anthropic.Anthropic(api_key=key)
    msg = client.messages.create(
        model=MODELS["anthropic"],
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text
