import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CodePanel({ reactCode, pythonCode, attempt, executionFailed }) {
  const [tab, setTab] = useState('react');
  const [copied, setCopied] = useState(false);

  const code = tab === 'react' ? reactCode : pythonCode;
  const lang = tab === 'react' ? 'jsx' : 'python';

  const copy = () => {
    navigator.clipboard.writeText(code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.left}>
          <span style={s.headerIcon}>🔧</span>
          <span style={s.headerTitle}>Agent 3 — Corrected Code</span>
          {attempt && (
            <span style={{ ...s.badge, background: executionFailed ? 'rgba(242,95,92,.12)' : 'rgba(62,207,142,.12)',
                           color: executionFailed ? 'var(--red)' : 'var(--green)' }}>
              {executionFailed ? `⚠ Failed after ${attempt} attempts` : `✓ Executed on attempt ${attempt}`}
            </span>
          )}
        </div>
        <div style={s.right}>
          <div style={s.tabs}>
            {['react','python'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ ...s.tab, ...(tab===t ? s.tabActive : {}) }}>
                {t === 'react' ? '⚛ App.jsx' : '🐍 app.py'}
              </button>
            ))}
          </div>
          <button onClick={copy} style={s.copy}>{copied ? '✓ Copied' : '⎘ Copy'}</button>
        </div>
      </div>

      <div style={s.codeWrap}>
        {code ? (
          <SyntaxHighlighter
            language={lang}
            style={vscDarkPlus}
            showLineNumbers
            customStyle={{ margin:0, borderRadius:'0 0 10px 10px', background:'#090a14',
                           fontSize:12.5, maxHeight:520, overflow:'auto' }}
          >
            {code}
          </SyntaxHighlighter>
        ) : (
          <div style={s.empty}>Waiting for corrector output...</div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' },
  header: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    background:'var(--surface)', padding:'10px 14px', borderBottom:'1px solid var(--border)',
    flexWrap:'wrap', gap:8,
  },
  left: { display:'flex', alignItems:'center', gap:10 },
  headerIcon: { fontSize:16 },
  headerTitle: { fontWeight:600, fontSize:14 },
  badge: { fontSize:11, fontFamily:'var(--mono)', padding:'3px 8px', borderRadius:5 },
  right: { display:'flex', alignItems:'center', gap:8 },
  tabs: { display:'flex', gap:3 },
  tab: {
    padding:'5px 12px', borderRadius:6, border:'none', background:'transparent',
    color:'var(--muted)', cursor:'pointer', fontSize:12, fontFamily:'var(--mono)',
  },
  tabActive: { background:'var(--surface2)', color:'var(--text)' },
  copy: {
    fontSize:11, fontFamily:'var(--mono)', background:'var(--surface2)',
    border:'1px solid var(--border)', color:'var(--muted)', padding:'4px 10px',
    borderRadius:5, cursor:'pointer',
  },
  codeWrap: { background:'#090a14' },
  empty: { padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 },
};
