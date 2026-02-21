"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/device";
import { fetchOptions, fetchSessionByCode, fetchVoteCounts } from "@/lib/results";

type OptionRow = { id: string; name: string; sort: number };
type SessionRow = { id: string; code: string; title: string | null; is_open: boolean };

export default function VotePage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const totalVotes = useMemo(() => {
    let t = 0;
    counts.forEach((v) => (t += v));
    return t;
  }, [counts]);

  const percentFor = (optionId: string) => {
    const c = counts.get(optionId) ?? 0;
    if (totalVotes === 0) return 0;
    return Math.round((c / totalVotes) * 100);
  };

  async function load() {
    setStatus("");
    const s = await fetchSessionByCode(code);
    setSession(s);

    const o = await fetchOptions(s.id);
    setOptions(o);

    const c = await fetchVoteCounts(s.id);
    setCounts(c);
  }

  useEffect(() => {
    load();

    // Live updates while voting happens
    const channel = supabase
      .channel(`votes-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, async () => {
        try {
          const s = await fetchSessionByCode(code);
          const c = await fetchVoteCounts(s.id);
          setCounts(c);
        } catch {
          // Ignore transient errors; the page still works.
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function castVote(optionId: string) {
    if (!session) return;

    if (!session.is_open) {
      setStatus("Voting is closed.");
      return;
    }

    setSelected(optionId);
    setStatus("Saving...");

    const deviceId = getDeviceId();

    // Allow re-voting by deleting prior vote for device+session, then inserting.
    await supabase.from("votes").delete().eq("session_id", session.id).eq("device_id", deviceId);

    const { error } = await supabase.from("votes").insert({
      session_id: session.id,
      option_id: optionId,
      device_id: deviceId,
    });

    if (error) {
      setStatus("Could not save vote.");
      return;
    }

    setStatus("Response saved | 1 vote");
  }

  return (
    <main className="h-screen overflow-hidden flex items-center justify-center px-6 py-6 vote-bg">
      <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center gap-5">
        {/* Title image (you provide) */}
        <div className="w-full flex flex-col items-center justify-center">
          <Image
            src="/title.png"
            alt="Kehoes Voting Title"
            width={900}
            height={220}
            priority
            className="w-[min(820px,90vw)] h-auto max-h-[18vh] object-contain"
          />
        </div>

        {/* Voting Card */}
        <div className="w-full max-w-xl rounded-2xl bg-gold-card p-6 shadow-2xl">
          <div className="text-white text-3xl md:text-4xl font-extrabold leading-tight">
            THE KEHOE&apos;S ACADEMY
            <br />
            VOTING ROUND 2
          </div>

          <div className="mt-6 rounded-2xl bg-gold-inner p-4 flex flex-col gap-3">
            {options.map((opt) => {
              const pct = percentFor(opt.id);
              const isSelected = selected === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => castVote(opt.id)}
                  className={[
                    "w-full rounded-xl px-6 py-5 flex items-center justify-between",
                    "transition transform active:scale-[0.99]",
                    isSelected ? "bg-dark-card text-white" : "bg-light-card text-white/95",
                  ].join(" ")}
                >
                  <span className="text-lg md:text-xl font-semibold">{opt.name}</span>
                  <span className="text-sm md:text-base font-bold">{pct}%</span>
                </button>
              );
            })}

            {/* Only show messages we explicitly set */}
            <div className="pt-1 text-center text-white/80 text-sm min-h-[20px]">
              {status}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
