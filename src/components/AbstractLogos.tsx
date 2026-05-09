import React from 'react';
import { FadeIn } from '../pages/Landing';

export const LogoOne = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M24 4L42 14.39V33.61L24 44L6 33.61V14.39L24 4Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    <path d="M24 24L42 14.39M24 24L6 14.39M24 24V44" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
    <circle cx="24" cy="24" r="5" fill="currentColor"/>
  </svg>
);

export const LogoTwo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <ellipse cx="24" cy="24" rx="20" ry="10" transform="rotate(-45 24 24)" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    <ellipse cx="24" cy="24" rx="20" ry="10" transform="rotate(45 24 24)" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
    <circle cx="24" cy="24" r="4" fill="currentColor"/>
  </svg>
);

export const LogoThree = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M24 6L42 38H6L24 6Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    <path d="M24 16L34 34H14L24 16Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
    <path d="M24 26L28 30H20L24 26Z" fill="currentColor"/>
  </svg>
);

export const LogoFour = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M24 4C24 4 40 16 40 30C40 38.8366 32.8366 46 24 46C15.1634 46 8 38.8366 8 30C8 16 24 4 24 4Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    <circle cx="24" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="3.5" opacity="0.3"/>
    <circle cx="24" cy="30" r="3" fill="currentColor"/>
  </svg>
);

export const LogoFive = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 16L24 8L36 16M12 32L24 40L36 32M12 16V32M36 16V32M24 8V40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
    <circle cx="24" cy="24" r="6" fill="currentColor"/>
    <circle cx="12" cy="16" r="4" fill="currentColor"/>
    <circle cx="36" cy="16" r="4" fill="currentColor"/>
    <circle cx="12" cy="32" r="4" fill="currentColor"/>
    <circle cx="36" cy="32" r="4" fill="currentColor"/>
  </svg>
);

export const LogoSix = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14 16C8.47715 16 4 20.4772 4 26C4 31.5228 8.47715 36 14 36H34C39.5228 36 44 31.5228 44 26C44 20.4772 39.5228 16 34 16H22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    <path d="M34 16C39.5228 16 44 11.5228 44 6M22 16L30 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
    <circle cx="14" cy="26" r="4" fill="currentColor"/>
  </svg>
);

const logos = [LogoOne, LogoTwo, LogoThree, LogoFour, LogoFive, LogoSix];

export const AbstractLogoStrip = () => {
  return (
    <section className="py-12 border-y border-[#e5e5e5] bg-transparent backdrop-blur-sm relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <FadeIn delay={100}>
          <p className="text-sm font-semibold text-[#1f1f1f] mb-2 uppercase tracking-wide">
            Trusted by modern, fast-growing teams
          </p>
          <p className="text-sm font-medium text-[#737373] mb-10">
            Empowering organizations to scale operations without friction
          </p>
        </FadeIn>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-x-20 md:gap-y-12 opacity-80">
          {logos.map((Logo, i) => (
            <FadeIn key={i} delay={200 + i * 50} direction="up">
              <div 
                className="transform text-[#9ca3af] transition-all duration-300 hover:text-[#1f1f1f] hover:scale-110 hover:opacity-100 cursor-default"
                aria-label="Abstract company logo"
              >
                <Logo className="w-10 h-10 md:w-12 md:h-12" />
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};
