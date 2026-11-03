import { useNavigate } from 'react-router-dom';
import { MISSIONS } from '../scoring/rules';
import { JOURNEY_COLORS } from './ui';

const W = 1000;
const H = 500;
const PAD = 20;

/**
 * Mapa esquemàtic del terreny de joc. Les posicions provenen de les coordenades dels números de missió
 * del diagrama de la p. 5 del PDF (aproximades, no a escala).
 */
export function FieldMap({ highlight, onSelect, compact }: { highlight?: string[]; onSelect?: (id: string) => void; compact?: boolean }) {
  const nav = useNavigate();
  const pins = MISSIONS.filter((m) => m.position);
  const fx = (x: number) => PAD + 40 + x * (W - 2 * PAD - 80);
  const fy = (y: number) => PAD + 30 + y * (H - 2 * PAD - 130);
  return (
    <svg className="fieldmap" viewBox={`0 0 ${W} ${H + (compact ? 0 : 40)}`} role="img" aria-label="Mapa esquemàtic del terreny de joc">
      <defs>
        <pattern id="studs" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="3.2" fill="rgba(255,255,255,0.18)" />
        </pattern>
        <linearGradient id="mat" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2a7fc9" />
          <stop offset="0.55" stopColor="#1f5fa0" />
          <stop offset="1" stopColor="#173f73" />
        </linearGradient>
      </defs>
      <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} rx="18" fill="url(#mat)" />
      <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} rx="18" fill="url(#studs)" />
      <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} rx="18" fill="none" stroke="#0d1b3e" strokeWidth="6" />
      {/* Àrees de llançament i casa (esquemàtic) */}
      <g>
        <rect x={PAD + 8} y={H - PAD - 110} width="250" height="102" rx="10" fill="rgba(255,213,0,0.22)" stroke="#ffd500" strokeWidth="3" strokeDasharray="10 6" />
        <text x={PAD + 133} y={H - PAD - 52} textAnchor="middle" fill="#ffe877" fontSize="20" fontWeight="800">Llançament esquerre</text>
        <rect x={W - PAD - 258} y={H - PAD - 110} width="250" height="102" rx="10" fill="rgba(255,213,0,0.22)" stroke="#ffd500" strokeWidth="3" strokeDasharray="10 6" />
        <text x={W - PAD - 133} y={H - PAD - 52} textAnchor="middle" fill="#ffe877" fontSize="20" fontWeight="800">Llançament dret</text>
      </g>
      {!compact && (
        <>
          <text x={PAD + 133} y={H + 24} textAnchor="middle" fill="#5d6680" fontSize="20" fontWeight="800">🏠 Casa esquerra</text>
          <text x={W - PAD - 133} y={H + 24} textAnchor="middle" fill="#5d6680" fontSize="20" fontWeight="800">Casa dreta 🏠</text>
          <text x={W / 2} y={H + 24} textAnchor="middle" fill="#9aa1b4" fontSize="15" fontWeight="700">Esquemàtic · posicions aproximades (p. 5)</text>
        </>
      )}
      {pins.map((m) => {
        const on = !highlight || highlight.includes(m.id);
        const x = fx(m.position!.x);
        const y = fy(m.position!.y);
        const color = m.journey ? JOURNEY_COLORS[m.journey] : '#e3000b';
        return (
          <g
            key={m.id}
            className="mpin"
            opacity={on ? 1 : 0.28}
            onClick={() => (onSelect ? onSelect(m.id) : nav(`/missions/${m.id}`))}
          >
            <title>{`M${m.number} · ${m.name}`}</title>
            <rect x={x - 21} y={y - 15} width="42" height="30" rx="7" fill={color} stroke="#0d1b3e" strokeWidth="3" />
            <rect x={x - 15} y={y - 21} width="10" height="7" rx="2" fill={color} stroke="#0d1b3e" strokeWidth="2.5" />
            <rect x={x + 5} y={y - 21} width="10" height="7" rx="2" fill={color} stroke="#0d1b3e" strokeWidth="2.5" />
            <text x={x} y={y + 7} textAnchor="middle" fill="#fff" fontSize="19" fontWeight="800" fontFamily="Fredoka Variable, sans-serif">{m.number}</text>
            {highlight?.includes(m.id) && (
              <circle cx={x} cy={y} r="30" fill="none" stroke="#ffd500" strokeWidth="4">
                <animate attributeName="r" values="27;36;27" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
