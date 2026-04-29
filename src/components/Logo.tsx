import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
}

export function Logo({ className, variant = 'full' }: LogoProps) {
  // Hexagon geometry
  const R = 20; // circumradius
  const G = 2.5; // gap between hexagons
  const w = R * 0.866025; // apothem
  const D = R * 1.73205 + G; // distance between centers

  const C1 = { x: 40, y: 28 }; // Top
  const C2 = { x: 40 - D * 0.5, y: 28 + D * 0.866025 }; // Bottom-left
  const C3 = { x: 40 + D * 0.5, y: 28 + D * 0.866025 }; // Bottom-right

  const hexPoints = `0,${-R} ${w},${-R/2} ${w},${R/2} 0,${R} ${-w},${R/2} ${-w},${-R/2}`;

  const gc = 1.5; // Gap for the cube faces
  const topFacePoints = `0,0 ${-w},${-R/2} 0,${-R} ${w},${-R/2}`;
  const leftFacePoints = `0,0 ${-w},${-R/2} ${-w},${R/2} 0,${R}`;
  const rightFacePoints = `0,0 ${w},${-R/2} ${w},${R/2} 0,${R}`;

  return (
    <svg 
      viewBox={variant === 'full' ? "0 0 280 90" : "0 0 80 90"} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
    >
      <g stroke="none">
        {/* Top Dark Hexagon */}
        <polygon 
          points={hexPoints} 
          className="fill-[#2d2d2d] dark:fill-gray-200" 
          transform={`translate(${C1.x}, ${C1.y})`} 
        />
        
        {/* Left Dark Hexagon */}
        <polygon 
          points={hexPoints} 
          className="fill-[#2d2d2d] dark:fill-gray-200" 
          transform={`translate(${C2.x}, ${C2.y})`} 
        />
        
        {/* Bottom Gold Cube */}
        <g transform={`translate(${C3.x}, ${C3.y})`}>
          {/* Top Face */}
          <polygon points={topFacePoints} fill="#dfc182" transform={`translate(0, ${-gc})`} />
          {/* Left Face */}
          <polygon points={leftFacePoints} fill="#a38042" transform={`translate(${-gc * 0.866025}, ${gc * 0.5})`} />
          {/* Right Face */}
          <polygon points={rightFacePoints} fill="#826330" transform={`translate(${gc * 0.866025}, ${gc * 0.5})`} />
        </g>
      </g>
      
      {variant === 'full' && (
        <text 
          x="90" 
          y="56" 
          fontFamily="'Geist Variable', Inter, sans-serif" 
          fontSize="36" 
          fontWeight="bold" 
          className="fill-[#2d2d2d] dark:fill-white"
        >
          Asset<tspan fill="#a38042">Hive</tspan>
        </text>
      )}
    </svg>
  );
}
