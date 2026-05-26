"use client";

import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'inherit',
      }}
    >
      <style>{`
        @keyframes float-404 {
          0%   { transform: translateY(0px);  }
          50%  { transform: translateY(-18px); }
          100% { transform: translateY(0px);  }
        }
        @keyframes gradient-shift {
          0%   { background-position: 0% 50%;   }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%;   }
        }
        .text-404 {
          font-size: clamp(120px, 22vw, 200px);
          font-weight: 900;
          letter-spacing: -0.05em;
          line-height: 1;
          background-image: linear-gradient(135deg, var(--cr), var(--pu), var(--cr-l), var(--pu));
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          user-select: none;
          animation: float-404 3.6s ease-in-out infinite, gradient-shift 5s ease infinite;
        }
      `}</style>
      <div className="text-404">404</div>

      <p
        style={{
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          marginTop: '8px',
          marginBottom: '40px',
        }}
      >
        Page not found
      </p>

      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 24px',
          border: '1.5px solid transparent',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.02em',
          textDecoration: 'none',
          color: 'var(--cr)',
          backgroundImage:
            'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Go Back
      </Link>
    </div>
  );
}
