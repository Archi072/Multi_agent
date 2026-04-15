import React, { useState, useRef, useEffect } from 'react';
import UploadZone from './components/UploadZone';
import PipelineLog from './components/PipelineLog';
import CodePanel from './components/CodePanel';
import ReviewPanel from './components/ReviewPanel';
import AppLauncher from './components/AppLauncher';

const BACKEND = 'http://localhost:8000';

export default function App() {
  const [running, setRunning]       = useState(false);
  const [events, setEvents]         = useState([]);
  const [error, setError]           = useState('');

  // Latest corrector output
  const [correctedReact, setCorrectedReact]   = useState('');
  const [correctedPython, setCorrectedPython] = useState('');
  const [reviewReport, setReviewReport]       = useState('');
  const [lastAttempt, setLastAttempt]         = useState(null);
  const [executionFailed, setExecutionFailed] = useState(false);

  // Executor result
  const [frontendUrl, setFrontendUrl] = useState('');
  const [backendUrl, setBackendUrl]   = useState('');
  const [done, setDone]               = useState(false);

  const rightRef = useRef();

  // Auto-scroll right panel when new content arrives
  useEffect(() => {
    if (done && rightRef.current) {
      rightRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [done]);

  const reset = () => {
    setEvents([]); setError('');
    setCorrectedReact(''); setCorrectedPython(''); setReviewReport('');
    setLastAttempt(null); setExecutionFailed(false);
    setFrontendUrl(''); setBackendUrl(''); setDone(false);
  };

  const handleUpload = async (file) => {
    reset();
    setRunning(true);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${BACKEND}/generate`, { method:'POST', body:form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Server error ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          let eventName = 'message', dataStr = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim();
            if (line.startsWith('data: '))  dataStr   = line.slice(6).trim();
          }
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (eventName === 'progress') {
              // Upsert by agent+attempt key
              setEvents(prev => {
                const key = `${data.agent}-${data.attempt ?? 0}`;
                const others = prev.filter(e => `${e.agent}-${e.attempt ?? 0}` !== key);
                return [...others, data];
              });

              // Capture corrector output (always keep latest)
              if (data.agent === 'corrector' && data.react_code) {
                setCorrectedReact(data.react_code);
                setCorrectedPython(data.python_code || '');
                setLastAttempt(data.attempt);
              }
              if (data.agent === 'reviewer' && data.report) {
                setReviewReport(data.report);
              }
            }

            if (eventName === 'done') {
              // Final corrected code (corrector's output that executed)
              if (data.react_code)  setCorrectedReact(data.react_code);
              if (data.python_code) setCorrectedPython(data.python_code);
              if (data.report)      setReviewReport(data.report);
              setLastAttempt(data.attempt);
              setExecutionFailed(!!data.execution_failed);
              if (data.frontend_url) setFrontendUrl(data.frontend_url);
              if (data.backend_url)  setBackendUrl(data.backend_url);
              setDone(true);
              setRunning(false);
            }

            if (eventName === 'error') {
              setError(data.message || 'Unknown pipeline error.');
              setRunning(false);
            }
          } catch (_) { /* ignore malformed SSE */ }
        }
      }
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  const hasResult = correctedReact || correctedPython;

  return (
    <div style={s.root}>
      {/* Subtle grid background */}
      <div style={s.grid} />

      {/* Top bar */}
      <header style={s.topbar}>
        <div style={s.logo}>
          <span style={s.logoMark}>⬡</span>
          <span style={s.logoText}>AgentForge</span>
          <span style={s.logoSub}>4-Agent AI Code Pipeline</span>
        </div>
        <div style={s.topRight}>
          {running && <span style={s.runningBadge}><span style={s.spinIcon}>⟳</span> Pipeline Running</span>}
          {done && !executionFailed && <span style={s.liveBadge}>🟢 App Live</span>}
        </div>
      </header>

      <div style={s.layout}>

        {/* ── LEFT PANEL: Upload + Pipeline Log ── */}
        <aside style={s.left}>
          <UploadZone onUpload={handleUpload} disabled={running} />

          {error && (
            <div style={s.errorBox}>
              <div style={s.errorTitle}>⚠ Pipeline Error</div>
              <div style={s.errorMsg}>{error}</div>
            </div>
          )}

          {events.length > 0 && (
            <div style={{ marginTop:24 }}>
              <PipelineLog events={events} />
            </div>
          )}
        </aside>

        {/* ── RIGHT PANEL: Results ── */}
        <main style={s.right} ref={rightRef}>
          {!hasResult && !running && (
            <div style={s.placeholder}>
              <div style={s.phIcon}>⬡</div>
              <div style={s.phTitle}>Results will appear here</div>
              <div style={s.phSub}>Upload a ZIP with BRD &amp; TDD documents to start the pipeline</div>
            </div>
          )}

          {/* App Launcher — shown at TOP when execution succeeds */}
          {done && !executionFailed && frontendUrl && (
            <div style={{ marginBottom:24 }}>
              <AppLauncher
                frontendUrl={frontendUrl}
                backendUrl={backendUrl}
                attempt={lastAttempt}
              />
            </div>
          )}

          {/* Execution failed notice */}
          {done && executionFailed && (
            <div style={s.failBox}>
              <div style={s.failTitle}>⚠ Execution Failed After {lastAttempt} Attempts</div>
              <div style={s.failMsg}>
                The pipeline could not produce a running app after {lastAttempt} retry cycles.
                The corrected code is shown below — you can run it manually.
              </div>
            </div>
          )}

          {/* Agent 3 corrected code — always shown when available */}
          {hasResult && (
            <div style={{ marginBottom:24 }}>
              <CodePanel
                reactCode={correctedReact}
                pythonCode={correctedPython}
                attempt={lastAttempt}
                executionFailed={executionFailed}
              />
            </div>
          )}

          {/* Agent 2 review report */}
          {reviewReport && (
            <div style={{ marginBottom:24 }}>
              <ReviewPanel report={reviewReport} attempt={lastAttempt} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const s = {
  root: { minHeight:'100vh', position:'relative', display:'flex', flexDirection:'column' },
  grid: {
    position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
    backgroundImage:'linear-gradient(rgba(108,99,255,.03) 1px, transparent 1px),linear-gradient(90deg,rgba(108,99,255,.03) 1px,transparent 1px)',
    backgroundSize:'44px 44px',
  },
  topbar: {
    position:'sticky', top:0, zIndex:10,
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 28px', background:'rgba(7,8,15,.88)',
    backdropFilter:'blur(14px)', borderBottom:'1px solid var(--border)',
  },
  logo: { display:'flex', alignItems:'center', gap:10 },
  logoMark: { fontSize:22, color:'var(--accent)' },
  logoText: { fontSize:17, fontWeight:700, fontFamily:'var(--mono)', letterSpacing:'-0.5px' },
  logoSub: { fontSize:11, color:'var(--muted)', fontFamily:'var(--mono)', marginLeft:4 },
  topRight: { display:'flex', alignItems:'center', gap:10 },
  runningBadge: {
    fontSize:11, fontFamily:'var(--mono)', padding:'4px 10px', borderRadius:5,
    background:'var(--accent-dim)', color:'var(--accent)', border:'1px solid rgba(108,99,255,.3)',
  },
  spinIcon: { display:'inline-block', animation:'spin 1s linear infinite', marginRight:4 },
  liveBadge: {
    fontSize:11, fontFamily:'var(--mono)', padding:'4px 10px', borderRadius:5,
    background:'rgba(62,207,142,.1)', color:'var(--green)', border:'1px solid rgba(62,207,142,.3)',
  },
  layout: {
    position:'relative', zIndex:1, flex:1,
    display:'grid', gridTemplateColumns:'360px 1fr',
  },
  left: {
    borderRight:'1px solid var(--border)', padding:'28px 24px',
    background:'var(--surface)', overflowY:'auto',
    position:'sticky', top:57, height:'calc(100vh - 57px)',
  },
  right: { padding:'28px 32px', overflowY:'auto', height:'calc(100vh - 57px)' },
  placeholder: {
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    height:'60vh', gap:12, opacity:.3,
  },
  phIcon: { fontSize:52, color:'var(--accent)' },
  phTitle: { fontSize:18, fontWeight:600 },
  phSub: { fontSize:13, color:'var(--muted)', textAlign:'center', maxWidth:340 },
  errorBox: {
    marginTop:16, padding:'14px 16px', borderRadius:10,
    background:'rgba(242,95,92,.07)', border:'1px solid rgba(242,95,92,.25)',
  },
  errorTitle: { fontWeight:600, color:'var(--red)', marginBottom:4, fontSize:13 },
  errorMsg: { fontSize:12, color:'var(--muted)', lineHeight:1.6 },
  failBox: {
    marginBottom:20, padding:'16px 20px', borderRadius:10,
    background:'rgba(242,95,92,.07)', border:'1px solid rgba(242,95,92,.25)',
  },
  failTitle: { fontWeight:700, color:'var(--red)', marginBottom:6, fontSize:14 },
  failMsg: { fontSize:12, color:'var(--muted)', lineHeight:1.7 },
};
