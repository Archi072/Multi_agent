import React, { useRef, useState } from 'react';

export default function UploadZone({ onUpload, disabled }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState(null);

  const accept = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.zip')) { alert('Please upload a .zip file.'); return; }
    setFile(f);
  };

  return (
    <div style={s.wrap}>
      <div style={s.label}>Upload Documents</div>
      <div
        style={{ ...s.zone, ...(drag ? s.zoneDrag : {}), ...(file ? s.zoneDone : {}) }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
        onClick={() => ref.current?.click()}
      >
        <input ref={ref} type="file" accept=".zip" style={{ display:'none' }}
          onChange={e => accept(e.target.files[0])} />
        {file ? (
          <>
            <div style={s.icon}>📦</div>
            <div style={s.filename}>{file.name}</div>
            <div style={s.size}>{(file.size/1024).toFixed(1)} KB — click to change</div>
          </>
        ) : (
          <>
            <div style={s.icon}>⬆</div>
            <div style={s.hint}>Drop your ZIP here or click to browse</div>
            <div style={s.sub}>Must contain BRD &amp; TDD documents (.txt .md .pdf .docx)</div>
          </>
        )}
      </div>

      <button
        style={{ ...s.btn, opacity: (!file || disabled) ? .45 : 1, cursor: (!file || disabled) ? 'not-allowed' : 'pointer' }}
        onClick={() => file && !disabled && onUpload(file)}
        disabled={!file || disabled}
      >
        {disabled ? '⟳  Pipeline Running...' : '▶  Run Pipeline'}
      </button>

      <div style={s.pipeline}>
        {['Extract','Generate','Review','Correct','Execute'].map((s2, i) => (
          <React.Fragment key={s2}>
            <div style={s.step}>
              <div style={s.stepNum}>{i+1}</div>
              <div style={s.stepLbl}>{s2}</div>
            </div>
            {i < 4 && <div style={s.arr}>→</div>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { display:'flex', flexDirection:'column', gap:16 },
  label: { fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'var(--muted)', fontFamily:'var(--mono)' },
  zone: {
    border:'2px dashed var(--border)', borderRadius:12, padding:'36px 20px',
    textAlign:'center', cursor:'pointer', transition:'all .2s',
    display:'flex', flexDirection:'column', alignItems:'center', gap:8,
    background:'var(--surface)',
  },
  zoneDrag: { borderColor:'var(--accent)', background:'var(--accent-dim)' },
  zoneDone: { borderColor:'var(--green)', borderStyle:'solid' },
  icon: { fontSize:32, marginBottom:4 },
  filename: { fontWeight:600, color:'var(--green)', fontSize:14 },
  size: { fontSize:12, color:'var(--muted)' },
  hint: { fontSize:14, fontWeight:500 },
  sub: { fontSize:12, color:'var(--muted)' },
  btn: {
    width:'100%', padding:'13px 0', borderRadius:9, border:'none',
    background:'var(--accent)', color:'#fff', fontSize:14,
    fontWeight:600, fontFamily:'var(--sans)', transition:'opacity .2s',
  },
  pipeline: { display:'flex', alignItems:'center', justifyContent:'center', gap:6, flexWrap:'wrap', marginTop:4 },
  step: { display:'flex', flexDirection:'column', alignItems:'center', gap:3 },
  stepNum: {
    width:26, height:26, borderRadius:'50%', border:'1px solid var(--border)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:11, fontFamily:'var(--mono)', color:'var(--muted)',
  },
  stepLbl: { fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' },
  arr: { color:'var(--border)', fontSize:12, marginBottom:14 },
};
