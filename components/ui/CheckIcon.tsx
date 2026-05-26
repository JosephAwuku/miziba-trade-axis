import React from 'react';

interface CheckIconProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

/** Stroke checkmark (Lucide-style) for steppers, buttons, and completion states. */
export const CheckIcon: React.FC<CheckIconProps> = ({
  size = 16,
  strokeWidth = 2.75,
  color = 'currentColor',
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
