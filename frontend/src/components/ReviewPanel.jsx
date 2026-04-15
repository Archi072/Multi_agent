import React, { useState } from 'react';

export default function ReviewPanel({ report, attempt }) {
  const [open, setOpen] = useState(true);
  if (!report) return null;

  const scoreMatch = report.match(/Overall Score:\s*(\d+)\/10/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const scoreColor = score >= 8 ? 'var(--green)' : score >= 5 ? 'var(--amber)' : 'var(--red)';

  const lines = report.split('\n');

  return (
    <div style={s.wrap}>
      <div style={s.header} onClick={() => setOpen(o => !o)}>
        <div style={s.left}>
          <span>🔍</span>
          <span style={s.title}>Agent 2 — Review Report</span>
          {attempt && <span style={s.att}>attempt {attempt}</span>}
          {score !== null && (
            <span style={{ ...s.score, borderColor: scoreColor, color: scoreColor }}>{score}/10</span>
          )}
        </div>
        <span style={s.toggle}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={s.body}>
          {lines.map((line, i) => {
            if (!line.trim()) return <div key={i} style={{ height:6 }} />;
            if (line.startsWith('## ')) return <h2 key={i} style={s.h2}>{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} style={s.h3}>{line.slice(4)}</h3>;
            if (line.includes('[CRITICAL]')) return <div key={i} style={s.critical}>🔴 {line.replace(/^-\s*/,'')}</div>;
            if (line.includes('[WARNING]'))  return <div key={i} style={s.warning}>🟡 {line.replace(/^-\s*/,'')}</div>;
            if (line.includes('[SUGGESTION]')) return <div key={i} style={s.suggestion}>🔵 {line.replace(/^-\s*/,'')}</div>;
            if (line.match(/^\s*[-*]\s/)) return <div key={i} style={s.bullet}>• {line.replace(/^\s*[-*]\s/,'')}</div>;
            if (line.match(/^\d+\.\s/)) return <div key={i} style={s.num}>{line}</div>;
            return <div key={i} style={s.para}>{line}</div>;
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' },
  header: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    background:'var(--surface)', padding:'12px 16px', cursor:'pointer',
    borderBottom:'1px solid var(--border)',
  },
  left: { display:'flex', alignItems:'center', gap:10 },
  title: { fontWeight:600, fontSize:14 },
  att: { fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)', background:'var(--surface2)', padding:'2px 6px', borderRadius:4 },
  score: { fontSize:13, fontWeight:700, fontFamily:'var(--mono)', border:'2px solid', borderRadius:5, padding:'1px 8px' },
  toggle: { fontSize:11, color:'var(--muted)' },
  body: { padding:'18px 20px', background:'var(--surface2)', maxHeight:460, overflowY:'auto' },
  h2: { fontSize:15, fontWeight:600, color:'var(--teal)', margin:'10px 0 4px', borderBottom:'1px solid var(--border)', paddingBottom:3 },
  h3: { fontSize:13, fontWeight:600, color:'var(--text)', margin:'8px 0 3px' },
  bullet: { fontSize:12, color:'var(--muted)', padding:'1px 0 1px 8px', lineHeight:1.6 },
  num: { fontSize:12, color:'var(--text)', padding:'2px 0', lineHeight:1.6 },
  para: { fontSize:12, color:'var(--muted)', lineHeight:1.7 },
  critical: { background:'rgba(242,95,92,.08)', border:'1px solid rgba(242,95,92,.2)', borderRadius:5, padding:'5px 10px', margin:'3px 0', fontSize:12, color:'var(--red)' },
  warning:  { background:'rgba(245,166,35,.08)', border:'1px solid rgba(245,166,35,.2)', borderRadius:5, padding:'5px 10px', margin:'3px 0', fontSize:12, color:'var(--amber)' },
  suggestion: { background:'rgba(108,99,255,.08)', border:'1px solid rgba(108,99,255,.2)', borderRadius:5, padding:'5px 10px', margin:'3px 0', fontSize:12, color:'var(--accent)' },
};
