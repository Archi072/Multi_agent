import React from 'react';

const AGENT_META = {
  extractor:      { icon:'📂', label:'Document Extractor' },
  code_generator: { icon:'🤖', label:'Agent 1 — Code Generator' },
  reviewer:       { icon:'🔍', label:'Agent 2 — Code Reviewer' },
  corrector:      { icon:'🔧', label:'Agent 3 — Code Corrector' },
  executor:       { icon:'🚀', label:'Agent 4 — Code Executor' },
};

export default function PipelineLog({ events }) {
  if (!events.length) return null;

  // Build a flat ordered log, grouping by agent+attempt
  const log = [];
  const seen = new Map();

  events.forEach(ev => {
    const key = `${ev.agent}-${ev.attempt ?? 0}`;
    if (ev.agent) {
      seen.set(key, ev);
    }
  });

  seen.forEach(ev => log.push(ev));

  return (
    <div style={s.wrap}>
      <div style={s.title}>Live Pipeline Log</div>
      <div style={s.feed}>
        {log.map((ev, i) => {
          const meta = AGENT_META[ev.agent] || { icon:'⬡', label: ev.agent };
          const statusColor = ev.status === 'done' ? 'var(--green)'
            : ev.status === 'running' ? 'var(--accent)'
            : ev.status === 'failed'  ? 'var(--red)'
            : 'var(--muted)';

          return (
            <div key={i} style={{ ...s.row, animation:'slideUp .3s ease both' }}>
              <div style={{ ...s.dot, background: statusColor }} />
              <div style={s.info}>
                <div style={s.agentRow}>
                  <span style={s.agentIcon}>{meta.icon}</span>
                  <span style={{ ...s.agentLabel, color: statusColor }}>{meta.label}</span>
                  {ev.attempt && <span style={s.attempt}>attempt {ev.attempt}</span>}
                  <span style={{ ...s.pill, background: pillBg(ev.status), color: statusColor }}>
                    {ev.status === 'running' ? <span style={s.spin}>⟳</span> : null} {ev.status}
                  </span>
                </div>
                <div style={s.msg}>{ev.message}</div>
                {ev.status === 'failed' && ev.error && (
                  <div style={s.errBox}>{ev.error}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pillBg(s) {
  if (s === 'done')    return 'rgba(62,207,142,.1)';
  if (s === 'running') return 'rgba(108,99,255,.12)';
  if (s === 'failed')  return 'rgba(242,95,92,.1)';
  return 'var(--surface2)';
}

const s = {
  wrap: { display:'flex', flexDirection:'column', gap:10 },
  title: { fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'var(--muted)', fontFamily:'var(--mono)' },
  feed: { display:'flex', flexDirection:'column', gap:6 },
  row: {
    display:'flex', gap:12, alignItems:'flex-start',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:10, padding:'10px 14px',
  },
  dot: { width:8, height:8, borderRadius:'50%', marginTop:6, flexShrink:0 },
  info: { flex:1, minWidth:0 },
  agentRow: { display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:2 },
  agentIcon: { fontSize:15 },
  agentLabel: { fontWeight:600, fontSize:13 },
  attempt: { fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)', background:'var(--surface2)', padding:'1px 6px', borderRadius:4 },
  pill: { fontSize:10, fontFamily:'var(--mono)', padding:'2px 7px', borderRadius:4, marginLeft:'auto' },
  spin: { display:'inline-block', animation:'spin 1s linear infinite' },
  msg: { fontSize:12, color:'var(--muted)', lineHeight:1.5 },
  errBox: {
    marginTop:6, fontSize:11, fontFamily:'var(--mono)', whiteSpace:'pre-wrap',
    background:'rgba(242,95,92,.06)', border:'1px solid rgba(242,95,92,.2)',
    borderRadius:6, padding:'8px 10px', color:'var(--red)',
  },
};
