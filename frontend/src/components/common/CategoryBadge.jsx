import { getCategoryIcon } from '../../utils/categoryIcons';

// Muted monochrome icon chip. The category colour appears only as a small accent dot.
export function CategoryChip({ color = '#9AA59C', icon, size = 32, dot = false }) {
  const Icon = getCategoryIcon(icon);
  return (
    <span className="cat-chip position-relative" style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.8} />
      {dot && <span className="cat-dot position-absolute" style={{ background: color, right: -2, top: -2, border: '2px solid #fff', width: 10, height: 10 }} />}
    </span>
  );
}

export default function CategoryBadge({ name, color = '#9AA59C' }) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className="cat-dot" style={{ background: color }} aria-hidden="true" />
      <span>{name}</span>
    </span>
  );
}
