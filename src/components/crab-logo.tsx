import * as React from "react";

export interface CrabLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function CrabLogo({
  size = 24,
  className = "h-6 w-6",
  ...props
}: CrabLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="MudCrab Manager Crab Logo"
      role="img"
      {...props}
    >
      {/* Eye stalks and eyes */}
      <circle cx="10" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      <line x1="10" y1="8.8" x2="10" y2="10.8" />
      <line x1="14" y1="8.8" x2="14" y2="10.8" />

      {/* Carapace (body shell) with subtle fill */}
      <path
        d="M5.5 14 C5.5 10.8 18.5 10.8 18.5 14 C18.5 18.2 5.5 18.2 5.5 14 Z"
        fill="currentColor"
        fillOpacity="0.25"
      />

      {/* Left Front Claw (Cheliped) */}
      <path
        d="M7 11.5 C5 9.5 3 8 2.5 5.5 C2 3 4.5 2.5 5.5 4 C6.2 5 5.5 6.5 4.5 7 C6 7.2 7.5 6 7.5 4 C7.5 2.5 10 3 9.5 5.5 C9 8 7.5 10.5 7 11.5"
        fill="currentColor"
        fillOpacity="0.25"
      />

      {/* Right Front Claw (Cheliped) */}
      <path
        d="M17 11.5 C19 9.5 21 8 21.5 5.5 C22 3 19.5 2.5 18.5 4 C17.8 5 18.5 6.5 19.5 7 C18 7.2 16.5 6 16.5 4 C16.5 2.5 14 3 14.5 5.5 C15 8 16.5 10.5 17 11.5"
        fill="currentColor"
        fillOpacity="0.25"
      />

      {/* Left Walking Legs */}
      <path d="M5.5 13.5 C4 14 2.8 14.8 1.8 16.2" />
      <path d="M6 15.5 C4.5 16.5 3.5 17.8 2.5 19.2" />
      <path d="M7.2 17.2 C6.2 18.5 5.2 19.8 4.2 21.2" />

      {/* Right Walking Legs */}
      <path d="M18.5 13.5 C20 14 21.2 14.8 22.2 16.2" />
      <path d="M18 15.5 C19.5 16.5 20.5 17.8 21.5 19.2" />
      <path d="M16.8 17.2 C17.8 18.5 18.8 19.8 19.8 21.2" />
    </svg>
  );
}

