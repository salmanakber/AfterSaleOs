"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  TOURS,
  isTourCompleted,
  markTourCompleted,
  skipWelcomeTour,
  type TourDefinition,
  type TourStep,
} from "@/lib/tours";

type TourContextValue = {
  active: TourDefinition | null;
  stepIndex: number;
  step: TourStep | null;
  startTour: (id: string) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  onTabHint?: (tab: string) => void;
  setTabHandler: (fn: ((tab: string) => void) | null) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useProductTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useProductTour must be used within TourProvider");
  return ctx;
}

/** Safe hook when provider may be absent (shouldn't happen in merchant shell). */
export function useOptionalTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [tabHandler, setTabHandlerState] = useState<((tab: string) => void) | null>(null);

  const setTabHandler = useCallback((fn: ((tab: string) => void) | null) => {
    setTabHandlerState(() => fn);
  }, []);

  const startTour = useCallback((id: string) => {
    const def = TOURS[id];
    if (!def) return;
    setActive(def);
    setStepIndex(0);
  }, []);

  const finish = useCallback(
    (skipped: boolean) => {
      if (active) {
        if (skipped && active.id === "welcome") skipWelcomeTour();
        else markTourCompleted(active.id);
      }
      setActive(null);
      setStepIndex(0);
    },
    [active],
  );

  const step = active?.steps[stepIndex] ?? null;

  useEffect(() => {
    if (step?.tab && tabHandler) tabHandler(step.tab);
  }, [step?.id, step?.tab, tabHandler]);

  const next = useCallback(() => {
    if (!active) return;
    if (stepIndex >= active.steps.length - 1) finish(false);
    else setStepIndex((i) => i + 1);
  }, [active, stepIndex, finish]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const value = useMemo(
    () => ({
      active,
      stepIndex,
      step,
      startTour,
      next,
      prev,
      skip: () => finish(true),
      setTabHandler,
    }),
    [active, stepIndex, step, startTour, next, prev, finish, setTabHandler],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && step ? (
        <TourOverlay
          tour={active}
          step={step}
          stepIndex={stepIndex}
          onNext={next}
          onPrev={prev}
          onSkip={() => finish(true)}
        />
      ) : null}
    </TourContext.Provider>
  );
}

function TourOverlay({
  tour,
  step,
  stepIndex,
  onNext,
  onPrev,
  onSkip,
}: {
  tour: TourDefinition;
  step: TourStep;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const total = tour.steps.length;
  const isLast = stepIndex === total - 1;

  useEffect(() => {
    function measure() {
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setRect(el.getBoundingClientRect());
    }
    measure();
    const t = window.setTimeout(measure, 280);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.id, step.target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      if (e.key === "ArrowLeft") onPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev, onSkip]);

  const pad = 8;
  const spotlight = rect
    ? {
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
        height: Math.min(window.innerHeight - 16, rect.height + pad * 2),
      }
    : null;

  const cardStyle = (() => {
    if (!spotlight) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } as const;
    }
    const below = spotlight.top + spotlight.height + 16;
    const spaceBelow = window.innerHeight - below;
    if (spaceBelow > 220) {
      return {
        top: below,
        left: Math.min(Math.max(16, spotlight.left), window.innerWidth - 360),
      } as const;
    }
    return {
      top: Math.max(16, spotlight.top - 210),
      left: Math.min(Math.max(16, spotlight.left), window.innerWidth - 360),
    } as const;
  })();

  return (
    <div className="as-m-tour" role="dialog" aria-modal="true" aria-label={tour.title}>
      <div className="as-m-tour-backdrop" onClick={onSkip} />
      {spotlight ? (
        <div
          className="as-m-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : null}
      <div className="as-m-tour-card" style={cardStyle}>
        <div className="as-m-tour-meta">
          <span>
            {tour.title} · {stepIndex + 1}/{total}
          </span>
          <button type="button" className="as-m-tour-skip" onClick={onSkip}>
            Skip
          </button>
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="as-m-tour-actions">
          <button type="button" className="as-m-tour-btn" onClick={onPrev} disabled={stepIndex === 0}>
            Back
          </button>
          <button type="button" className="as-m-tour-btn as-m-tour-btn-primary" onClick={onNext}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TourTrigger({
  tourId,
  label = "Take a tour",
  className = "as-m-chip",
}: {
  tourId: string;
  label?: string;
  className?: string;
}) {
  const tour = useOptionalTour();
  if (!tour) return null;
  const done = isTourCompleted(tourId);
  return (
    <button
      type="button"
      className={className}
      onClick={() => tour.startTour(tourId)}
      data-tour-trigger={tourId}
    >
      {done ? "Replay tour" : label}
    </button>
  );
}
