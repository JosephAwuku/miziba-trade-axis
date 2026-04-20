import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '', style }) => {
  return (
    <span className={`badge badge-${variant} ${className}`} style={style}>
      {children}
    </span>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'navy' | 'ghost';
  size?: 'sm' | 'md';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  return (
    <button 
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

interface ProgressBarProps {
  value: number;
  height?: string;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, height = '6px', color }) => {
  const barColor = color || (value > 80 ? 'var(--wa)' : 'var(--su)');
  return (
    <div className="pbar" style={{ height }}>
      <div 
        className="pbar-fill" 
        style={{ 
          width: `${Math.min(100, Math.max(0, value))}%`,
          backgroundColor: barColor
        }}
      ></div>
    </div>
  );
};

export const Card: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  title?: string; 
  headerAction?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ 
  children, 
  className = '', 
  title,
  headerAction,
  style
}) => {
  return (
    <div className={`card ${className}`} style={style}>
      {title && (
        <div className="card-head">
          <span>{title}</span>
          {headerAction}
        </div>
      )}
      {children}
    </div>
  );
};
