/**
 * Countdown widget — commissioner-configured countdown to a date/time
 * (e.g. draft night, trade deadline), shown on the dashboard.
 *
 * Renders null when there's no huddle linked to the selected league, no
 * countdown has been configured, or the commissioner has disabled it.
 *
 * Placement: to the right of Announcements in DashboardPage.
 */
import { useEffect, useState } from "react";
import { useSelectedLeagueHuddle, useCountdownConfig } from "../../hooks/useHuddles";
import { SectionHead } from "./_shared";
import type { CountdownConfig } from "../../types/huddle";

function Digit({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-serif font-semibold tabular-nums leading-none text-2xl text-ink">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[9.5px] font-semibold tracking-[0.16em] uppercase text-muted font-sans">
        {label}
      </div>
    </div>
  );
}

function CountdownDisplay({ config }: { config: CountdownConfig }) {
  const target = new Date(config.targetAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
  const minutes = Math.floor((diff / (60 * 1000)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return (
    <div className="border border-line rounded-lg p-5 bg-paper flex flex-col gap-1">
      <SectionHead kicker="COUNTDOWN" title={config.title} rule={null} />
      {config.subtitle && (
        <p className="-mt-2 mb-1 text-[12.5px] text-muted font-sans leading-relaxed">
          {config.subtitle}
        </p>
      )}
      {diff === 0 ? (
        <p className="font-serif font-semibold text-lg text-ink">It's here!</p>
      ) : (
        <div className="flex items-center gap-4">
          <Digit label="Days" value={days} />
          <Digit label="Hrs" value={hours} />
          <Digit label="Min" value={minutes} />
          <Digit label="Sec" value={seconds} />
        </div>
      )}
    </div>
  );
}

export function CountdownWidget() {
  const huddle = useSelectedLeagueHuddle();
  const { data: config } = useCountdownConfig(huddle?.id ?? null);
  if (!config || !config.enabled) return null;
  return <CountdownDisplay config={config} />;
}
