import React, { useState, useEffect } from 'react';

export default function AppLauncher({ frontendUrl, backendUrl, attempt }) {
  const [backendAlive, setBackendAlive] = useState(null);

  // Ping backend health every 5s to confirm it's still up
  useEffect(() => {
    if (!backendUrl) return;
    const check = async () => {
      try {
        await fetch(backendUrl, { mode: 'no-cors' });
        setBackendAlive(true);
      } catch {
        setBackendAlive(false);
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [backendUrl]);

  if (!frontendUrl) return null;

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.pulse} />
        <span style={s.title}>Generated App is Live</span>
        <span style={s.attempt}>executed on attempt {attempt}</span>
      </div>

      {/* Main CTA */}
      <div style={s.cta}>
        <div style={s.ctaText}>
          <div style={s.ctaHeading}>Your AI-Generated App is Running</div>
          <div style={s.ctaSub}>
            Click the button below to open the generated app in a new tab.
            The React frontend is fully connected to the FastAPI backend.
          </div>
        </div>
        <a href={frontendUrl} target="_blank" rel="noreferrer" style={s.openBtn}>
          Open Generated App ↗
        </a>
      </div>

      {/* URLs */}
      <div style={s.urls}>
        <div style={s.urlRow}>
          <span style={s.urlLabel}>⚛ React Frontend</span>
          <a href={frontendUrl} target="_blank" rel="noreferrer" style={s.urlLink}>{frontendUrl}</a>
          <span style={{ ...s.dot, background:'var(--green)' }} title="Running" />
        </div>
        <div style={s.urlRow}>
          <span style={s.urlLabel}>🐍 FastAPI Backend</span>
          <a href={`${backendUrl}/docs`} target="_blank" rel="noreferrer" style={s.urlLink}>{backendUrl}</a>
          <span style={{ ...s.dot, background: backendAlive === false ? 'var(--red)' : 'var(--green)' }}
                title={backendAlive === false ? 'Not responding' : 'Running'} />
        </div>
        <div style={s.urlRow}>
          <span style={s.urlLabel}>📚 API Docs (Swagger)</span>
          <a href={`${backendUrl}/docs`} target="_blank" rel="noreferrer" style={s.urlLink}>{backendUrl}/docs</a>
        </div>
      </div>

      <div style={s.note}>
        💡 The generated app continues running in the background. Close its terminal processes to stop it.
      </div>
    </div>
  );
}

const s = {
  wrap: {
    border:'1px solid rgba(62,207,142,.3)', borderRadius:12,
    overflow:'hidden', animation:'slideUp .4s ease both',
  },
  header: {
    display:'flex', alignItems:'center', gap:10, padding:'12px 18px',
    background:'rgba(62,207,142,.06)', borderBottom:'1px solid rgba(62,207,142,.15)',
  },
  pulse: {
    width:10, height:10, borderRadius:'50%', background:'var(--green)',
    animation:'glow 2s ease infinite',
  },
  title: { fontWeight:700, fontSize:14, color:'var(--green)' },
  attempt: { fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)', background:'var(--surface2)', padding:'2px 7px', borderRadius:4, marginLeft:'auto' },
  cta: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    flexWrap:'wrap', gap:16, padding:'20px 20px', borderBottom:'1px solid var(--border)',
  },
  ctaText: { flex:1, minWidth:200 },
  ctaHeading: { fontWeight:700, fontSize:16, marginBottom:4 },
  ctaSub: { fontSize:12, color:'var(--muted)', lineHeight:1.6 },
  openBtn: {
    display:'inline-block', padding:'12px 24px', borderRadius:9,
    background:'var(--green)', color:'#000', fontWeight:700, fontSize:14,
    textDecoration:'none', whiteSpace:'nowrap', flexShrink:0,
  },
  urls: { padding:'14px 20px', display:'flex', flexDirection:'column', gap:10 },
  urlRow: { display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' },
  urlLabel: { fontSize:12, color:'var(--muted)', width:170, flexShrink:0 },
  urlLink: { fontSize:12, fontFamily:'var(--mono)', color:'var(--accent)', textDecoration:'none' },
  dot: { width:7, height:7, borderRadius:'50%', flexShrink:0 },
  note: { padding:'10px 20px', fontSize:11, color:'var(--muted)', background:'var(--surface)', borderTop:'1px solid var(--border)' },
};
