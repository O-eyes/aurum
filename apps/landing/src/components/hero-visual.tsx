/**
 * Decorative hero illustration — stacked vault gold bars with a floating AUR
 * token. Pure SVG: zero image requests, crisp at any DPI, ~2 KB gzipped.
 */
export function HeroVisual({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Stacked gold bars with an Aurum token"
    >
      <defs>
        <linearGradient id="barTop" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="barFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="barSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="1" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.55" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f59e0b" stopOpacity="0.28" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient glow */}
      <ellipse cx="320" cy="190" rx="300" ry="110" fill="url(#glow)" />

      {/* ── Bottom row: two bars ── */}
      {/* Left bar */}
      <g>
        <polygon
          points="150,196 290,196 310,236 130,236"
          fill="url(#barFront)"
        />
        <polygon points="150,196 290,196 282,180 162,180" fill="url(#barTop)" />
        <polygon
          points="290,196 310,236 302,220 282,180"
          fill="url(#barSide)"
        />
        <text
          x="220"
          y="222"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="15"
          fontWeight="bold"
          fill="#fde68a"
          opacity="0.85"
        >
          999.9 FINE GOLD
        </text>
      </g>
      {/* Right bar */}
      <g>
        <polygon
          points="330,196 470,196 490,236 310,236"
          fill="url(#barFront)"
          transform="translate(28 0)"
        />
        <polygon
          points="330,196 470,196 462,180 342,180"
          fill="url(#barTop)"
          transform="translate(28 0)"
        />
        <polygon
          points="470,196 490,236 482,220 462,180"
          fill="url(#barSide)"
          transform="translate(28 0)"
        />
        <text
          x="428"
          y="222"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="15"
          fontWeight="bold"
          fill="#fde68a"
          opacity="0.85"
        >
          1 TROY OUNCE
        </text>
      </g>

      {/* ── Top bar, centred ── */}
      <g>
        <polygon
          points="245,148 385,148 403,184 227,184"
          fill="url(#barFront)"
        />
        <polygon points="245,148 385,148 377,133 253,133" fill="url(#barTop)" />
        <polygon
          points="385,148 403,184 395,169 377,133"
          fill="url(#barSide)"
        />
        <text
          x="315"
          y="172"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="14"
          fontWeight="bold"
          fill="#fde68a"
          opacity="0.85"
        >
          GOLDBOD VAULT
        </text>
      </g>

      {/* ── Floating AUR token ── */}
      <g>
        <circle cx="320" cy="72" r="46" fill="url(#coin)" />
        <circle
          cx="320"
          cy="72"
          r="46"
          fill="none"
          stroke="#78350f"
          strokeWidth="2"
          opacity="0.5"
        />
        <circle
          cx="320"
          cy="72"
          r="37"
          fill="none"
          stroke="#fde68a"
          strokeWidth="1.6"
          strokeDasharray="3 4"
          opacity="0.9"
        />
        <text
          x="320"
          y="84"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="32"
          fontWeight="bold"
          fill="#ffffff"
        >
          Au
        </text>
        {/* Sparkles */}
        <path
          d="M262 38 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"
          fill="#fde68a"
          opacity="0.9"
        />
        <path
          d="M382 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"
          fill="#fde68a"
          opacity="0.7"
        />
        <path
          d="M376 30 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z"
          fill="#fff7ed"
          opacity="0.8"
        />
      </g>

      {/* Token → bars link line */}
      <line
        x1="320"
        y1="118"
        x2="320"
        y2="130"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeDasharray="2 4"
        opacity="0.6"
      />

      {/* Reflection */}
      <ellipse
        cx="320"
        cy="252"
        rx="220"
        ry="10"
        fill="#f59e0b"
        opacity="0.08"
      />
    </svg>
  );
}
