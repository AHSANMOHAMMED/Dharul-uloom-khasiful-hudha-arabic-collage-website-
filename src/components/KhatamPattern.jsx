/**
 * KhatamPattern
 * Authentic 8-point star (Khatam Sulayman) geometric watermark.
 * Used at 4-6% opacity in heroes, card headers, footers, and modal backdrops.
 */
export default function KhatamPattern({
  className = "opacity-[0.05]",
  strokeColor = "#FBF8F0",
  id = "khatam-pattern-svg"
}) {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      height="100%"
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={id}
          width="80"
          height="80"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M40 0 L52 28 L80 40 L52 52 L40 80 L28 52 L0 40 L28 28 Z"
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.75"
          />
          <rect
            x="20"
            y="20"
            width="40"
            height="40"
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.5"
            transform="rotate(45 40 40)"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

