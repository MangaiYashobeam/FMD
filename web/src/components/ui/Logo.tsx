/**
 * Dealers Face - Brand Logo Components
 * Clean, professional SVG logos with car silhouette and marketplace elements
 */

import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  theme?: 'light' | 'dark';
}

const sizeMap = {
  sm: { icon: 24, full: 120 },
  md: { icon: 32, full: 160 },
  lg: { icon: 48, full: 200 },
  xl: { icon: 64, full: 280 },
};

/**
 * Main Logo - Car silhouette with marketplace tag
 */
export const DealersFaceLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  theme = 'light',
}) => {
  const iconSize = sizeMap[size].icon;
  const fullWidth = sizeMap[size].full;
  const primaryColor = theme === 'light' ? '#1e40af' : '#60a5fa';
  const secondaryColor = theme === 'light' ? '#3b82f6' : '#93c5fd';
  const textColor = theme === 'light' ? '#111827' : '#ffffff';

  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 64 64"
        width={iconSize}
        height={iconSize}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle */}
        <circle cx="32" cy="32" r="30" fill={primaryColor} />
        
        {/* Car silhouette */}
        <g transform="translate(10, 18)">
          {/* Car body */}
          <path
            d="M4 20 L4 14 C4 12 5 11 7 10 L12 8 C13 7 15 6 18 6 L26 6 C29 6 31 7 32 8 L37 10 C39 11 40 12 40 14 L40 20 C40 22 39 23 37 23 L7 23 C5 23 4 22 4 20 Z"
            fill="white"
          />
          {/* Windows */}
          <path
            d="M13 8 L18 8 L18 14 L10 14 C10 11 11 9 13 8 Z"
            fill={secondaryColor}
            opacity="0.8"
          />
          <path
            d="M20 8 L26 8 C28 8 30 9 31 10 L34 14 L20 14 Z"
            fill={secondaryColor}
            opacity="0.8"
          />
          {/* Wheels */}
          <circle cx="12" cy="23" r="4" fill="white" />
          <circle cx="12" cy="23" r="2" fill={primaryColor} />
          <circle cx="32" cy="23" r="4" fill="white" />
          <circle cx="32" cy="23" r="2" fill={primaryColor} />
        </g>
        
        {/* Marketplace tag */}
        <rect x="38" y="6" width="20" height="14" rx="3" fill={secondaryColor} />
        <text x="48" y="16" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">$</text>
      </svg>
    );
  }

  if (variant === 'text') {
    return (
      <svg
        viewBox="0 0 180 40"
        width={fullWidth}
        height={fullWidth * 0.22}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="0"
          y="30"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          fontSize="28"
          fontWeight="700"
          fill={textColor}
          letterSpacing="-0.5"
        >
          <tspan fill={primaryColor}>Dealers</tspan>
          <tspan fill={textColor}> Face</tspan>
        </text>
      </svg>
    );
  }

  // Full logo with icon + text
  return (
    <svg
      viewBox="0 0 240 56"
      width={fullWidth}
      height={fullWidth * 0.23}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Icon */}
      <g transform="translate(0, 0)">
        {/* Background rounded square */}
        <rect x="2" y="2" width="52" height="52" rx="12" fill={primaryColor} />
        
        {/* Car silhouette */}
        <g transform="translate(6, 12)">
          {/* Car body */}
          <path
            d="M3 22 L3 16 C3 14 4 13 6 12 L10 10 C11 9 13 8 16 8 L24 8 C27 8 29 9 30 10 L34 12 C36 13 37 14 37 16 L37 22 C37 24 36 25 34 25 L6 25 C4 25 3 24 3 22 Z"
            fill="white"
          />
          {/* Windows */}
          <path
            d="M11 10 L16 10 L16 15 L8 15 C8 12 9 11 11 10 Z"
            fill={secondaryColor}
            opacity="0.7"
          />
          <path
            d="M18 10 L24 10 C26 10 28 11 29 12 L31 15 L18 15 Z"
            fill={secondaryColor}
            opacity="0.7"
          />
          {/* Wheels */}
          <circle cx="11" cy="25" r="4" fill="white" />
          <circle cx="11" cy="25" r="2" fill={primaryColor} />
          <circle cx="29" cy="25" r="4" fill="white" />
          <circle cx="29" cy="25" r="2" fill={primaryColor} />
        </g>
        
        {/* Marketplace price tag */}
        <g transform="translate(34, 4)">
          <rect width="18" height="12" rx="3" fill={secondaryColor} />
          <text x="9" y="9" fontSize="8" fontWeight="bold" fill="white" textAnchor="middle">$</text>
        </g>
      </g>
      
      {/* Text */}
      <text
        x="64"
        y="38"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        <tspan fill={primaryColor}>Dealers</tspan>
        <tspan fill={textColor}> Face</tspan>
      </text>
    </svg>
  );
};

/**
 * Inline Logo Icon - For use in navigation bars
 */
export const DealersFaceIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => (
  <svg
    viewBox="0 0 56 56"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Gradient background */}
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e40af" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
    </defs>
    
    {/* Background */}
    <rect x="2" y="2" width="52" height="52" rx="12" fill="url(#logoGradient)" />
    
    {/* Car silhouette - simplified and clean */}
    <g transform="translate(6, 12)">
      {/* Car body */}
      <path
        d="M3 22 L3 16 C3 14 4 13 6 12 L10 10 C11 9 13 8 16 8 L24 8 C27 8 29 9 30 10 L34 12 C36 13 37 14 37 16 L37 22 C37 24 36 25 34 25 L6 25 C4 25 3 24 3 22 Z"
        fill="white"
      />
      {/* Window line */}
      <path
        d="M8 15 L16 15 L16 10 M18 10 L18 15 L31 15"
        stroke="#60a5fa"
        strokeWidth="1.5"
        fill="none"
        opacity="0.8"
      />
      {/* Wheels */}
      <circle cx="11" cy="25" r="4" fill="white" />
      <circle cx="11" cy="25" r="2" fill="#1e40af" />
      <circle cx="29" cy="25" r="4" fill="white" />
      <circle cx="29" cy="25" r="2" fill="#1e40af" />
    </g>
    
    {/* Price tag badge */}
    <rect x="36" y="4" width="16" height="11" rx="3" fill="#22c55e" />
    <text x="44" y="12" fontSize="8" fontWeight="bold" fill="white" textAnchor="middle">$</text>
  </svg>
);

/**
 * Favicon/App Icon - Square format
 */
export const DealersFaceFavicon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="32" height="32" rx="6" fill="#1e40af" />
    <g transform="translate(3, 7)">
      {/* Simplified car */}
      <path
        d="M2 12 L2 9 C2 8 2.5 7 4 6.5 L7 5.5 C8 5 9 4.5 11 4.5 L15 4.5 C17 4.5 18 5 19 5.5 L22 6.5 C23.5 7 24 8 24 9 L24 12 C24 13 23.5 13.5 22 13.5 L4 13.5 C2.5 13.5 2 13 2 12 Z"
        fill="white"
      />
      <circle cx="7" cy="13.5" r="2.5" fill="white" />
      <circle cx="7" cy="13.5" r="1.2" fill="#1e40af" />
      <circle cx="19" cy="13.5" r="2.5" fill="white" />
      <circle cx="19" cy="13.5" r="1.2" fill="#1e40af" />
    </g>
    {/* Small price badge */}
    <rect x="21" y="2" width="9" height="7" rx="2" fill="#22c55e" />
    <text x="25.5" y="7" fontSize="5" fontWeight="bold" fill="white" textAnchor="middle">$</text>
  </svg>
);

export default DealersFaceLogo;
