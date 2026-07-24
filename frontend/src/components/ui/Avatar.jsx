/**
 * User avatar — shows the uploaded profile picture (`src`) if present, otherwise
 * a colored circle with the user's initials. Theme-aware via tokens.
 */
export default function Avatar({ src, name, size = 36 }) {
  const initials =
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || '?';

  if (src) {
    return (
      <img
        className="avatar avatar-img"
        src={src}
        alt=""
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials}
    </span>
  );
}
