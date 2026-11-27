import { useEffect, useState } from 'react';
import { parseNum, fmtNum } from '../workouts.js';

/** Campo numérico amigável ao iOS: teclado numérico, aceita vírgula, salva ao sair do campo. */
export default function NumField({ value, onCommit, decimal = false, min = 0, max = 999, label, suffix, className = '', allowEmpty = false, placeholder }) {
  const [text, setText] = useState(fmtNum(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmtNum(value)); }, [value, focused]);

  function commit() {
    setFocused(false);
    if (allowEmpty && text.trim() === '') { if (value != null) onCommit(null); return; }
    let n = parseNum(text);
    if (n == null) { setText(fmtNum(value)); return; }
    if (!decimal) n = Math.round(n);
    n = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
    setText(fmtNum(n));
    if (n !== value) onCommit(n);
  }

  return (
    <label className={`num ${className}`}>
      {label && <span className="num-label">{label}</span>}
      <span className="num-box">
        <input
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
          value={text}
          placeholder={placeholder}
          onFocus={e => { setFocused(true); e.target.select(); }}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
        {suffix && <span className="num-suffix">{suffix}</span>}
      </span>
    </label>
  );
}
