// The two logos as inline SVG (crisp at any size). giveback is the platform; Riverside is the example vendor.
import { useId } from 'react';

export function GivebackMark({ size = 30, color = '#4f6b3a', title = 'giveback' }: { size?: number; color?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={title}>
      <circle cx="29" cy="28" r="13" />
      <path d="M42 15V44C42 53 35 57 25 57C19 57 14 55 11 51" />
      <path d="M16 50L10 52L11 45" strokeWidth="5" />
    </svg>
  );
}

export function RiversideMark({ size = 36, title = 'Riverside Community Kitchen' }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs><clipPath id={id}><circle cx="32" cy="32" r="31" /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <rect width="64" height="64" fill="#1c5d86" />
        <circle cx="32" cy="25" r="8.5" fill="#f6a04d" />
        <rect y="33" width="64" height="31" fill="#cdeaf5" />
        <path d="M29 36H35M30 40H34.5M30.5 44H37" stroke="#f6a04d" strokeWidth="1.4" strokeLinecap="round" opacity=".85" />
        <path d="M0 33C9 27 19 29 28 34C24 40 31 46 25 52C21 57 16 60 10 64L0 64Z" fill="#164a63" />
        <path d="M64 32C55 27 46 30 36 35C41 41 33 47 39 53C43 57 50 60 58 64L64 64Z" fill="#2a7f8f" />
      </g>
      <circle cx="32" cy="32" r="31" fill="none" stroke="#13324a" strokeWidth="1.5" />
    </svg>
  );
}
