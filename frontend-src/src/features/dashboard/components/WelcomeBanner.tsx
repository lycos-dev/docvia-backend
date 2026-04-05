import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionTemplate, useSpring } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../../shared/contexts/AuthContext';

function resolveDisplayName(
  username: string | null | undefined,
  email: string | null | undefined
): string {
  const u = username?.trim();
  if (u) return u;
  const local = email?.split('@')[0]?.trim();
  if (local) return local;
  return 'there';
}

export default function WelcomeBanner() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = useMemo(
    () => resolveDisplayName(user?.username, user?.email),
    [user?.username, user?.email]
  );

  const mouseX = useSpring(0, { stiffness: 120, damping: 25, mass: 0.4 });
  const mouseY = useSpring(0, { stiffness: 120, damping: 25, mass: 0.4 });

  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${mouseX}px ${mouseY}px, rgba(137, 173, 226, 0.35), transparent 55%)`;
  const spotlightDark = useMotionTemplate`radial-gradient(520px circle at ${mouseX}px ${mouseY}px, rgba(137, 173, 226, 0.18), transparent 55%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mouseX.set(e.clientX - r.left);
    mouseY.set(e.clientY - r.top);
  };

  const handlePointerLeave = () => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mouseX.set(r.width * 0.72);
    mouseY.set(r.height * 0.35);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mouseX.set(r.width * 0.72);
    mouseY.set(r.height * 0.35);
  }, [mouseX, mouseY]);

  return (
    <motion.section
      ref={containerRef}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      whileHover={{
        scale: 1.008,
        transition: { type: 'spring', stiffness: 380, damping: 28 },
      }}
      className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-gradient-to-br from-[#e8f0ff] via-[#dbe7ff] to-[#cfe0ff] dark:from-[#1e293b] dark:via-[#172554]/80 dark:to-[#0f172a] shadow-[0_12px_40px_-12px_rgba(59,130,246,0.25)] dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)] cursor-default select-none"
    >
      {/* Interactive light spot (follows pointer) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-100 dark:hidden"
        style={{ background: spotlight }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block opacity-100"
        style={{ background: spotlightDark }}
      />

      {/* Soft orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/25 dark:bg-primary/15 blur-3xl motion-safe:animate-pulse motion-safe:[animation-duration:5s]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-[#a5c2eb]/40 dark:bg-blue-500/10 blur-3xl motion-safe:animate-pulse motion-safe:[animation-duration:6s] motion-safe:[animation-delay:1s]"
      />

      <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 dark:border-primary/20 bg-white/60 dark:bg-white/5 px-3 py-1 text-xs font-medium text-[#3b5bdb] dark:text-primary-light backdrop-blur-sm transition-colors duration-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Your learning hub</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-[#111827] dark:text-slate-100 md:text-3xl transition-colors duration-300">
            Hello,{' '}
            <span className="bg-gradient-to-r from-[#3b5bdb] via-primary to-[#6b93d1] dark:from-primary-light dark:via-primary dark:to-primary-dark bg-clip-text text-transparent">
              {displayName}
            </span>
          </h2>

          <p className="text-sm leading-relaxed text-[#4b5563] dark:text-slate-300 md:text-[15px] transition-colors duration-300">
            Pick up where you left off, explore your documents, and follow your roadmap.
            Every chapter you finish builds momentum—small steps add up to real mastery.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to="/progress"
              className="group inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white shadow-md transition-[transform,box-shadow,background-color] duration-300 hover:bg-[#1f2937] hover:shadow-lg active:scale-[0.98] dark:bg-primary dark:text-slate-900 dark:hover:bg-primary-light"
            >
              View progress
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </div>

        <motion.div
          className="relative mx-auto flex shrink-0 md:mx-0"
          animate={{ y: [0, -7, 0] }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-white/50 dark:bg-white/5 blur-2xl" />
          <img
            src="/assets/images/penguin.png"
            alt=""
            className="relative w-36 drop-shadow-lg md:w-44 pointer-events-none"
          />
        </motion.div>
      </div>
    </motion.section>
  );
}
