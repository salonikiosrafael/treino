/** Ícones simples (traço) dos tipos de cardio. */
const PATHS = {
  bike: <><circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M5.5 17 9 9.5h6.5L18.5 17M9 9.5 12 17h1.5l2-7.5M8 6.5h3M14.5 6h2.5l-1.5 3.5" /></>,
  esteira: <><circle cx="14.5" cy="3.8" r="1.8" /><path d="M9 10.5 11.5 8h3.5l1.8 3.2 2.7 1M12.5 8.5 11 13l3.5 2.5-1 3.5M11 13l-3.5 3.5H5" /><path d="M3 21h18" /></>,
  natacao: <><circle cx="17" cy="7.5" r="1.8" /><path d="m5 13 5.5-4 2.5 2.8L10 14" /><path d="M2.5 17.5c2 0 2-1.4 4.4-1.4s2.4 1.4 4.6 1.4 2.4-1.4 4.6-1.4 2.4 1.4 5.4 1.4M2.5 21c2 0 2-1.4 4.4-1.4s2.4 1.4 4.6 1.4 2.4-1.4 4.6-1.4 2.4 1.4 5.4 1.4" /></>,
  outro: <path d="M2.5 12h4l2.5-6 4.5 12 2.5-6h5.5" />,
};

export default function CardioIcon({ type, size = 24 }) {
  return (
    <svg className="cardio-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[type] ?? PATHS.outro}
    </svg>
  );
}
