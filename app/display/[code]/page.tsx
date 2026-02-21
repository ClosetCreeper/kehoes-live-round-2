"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchOptions, fetchSessionByCode, fetchVoteCounts } from "@/lib/results";
import QRCode from "qrcode.react";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

type OptionRow = { id: string; name: string; sort: number };
type SessionRow = { id: string; code: string; title: string | null; is_open: boolean };

// 🎨 Elegant gold palette (auto-cycles)
const GOLD_COLORS = [
  "#E7C873", // light gold
  "#D4AF37", // classic gold
  "#C5A028", // deeper gold
  "#B8961E", // warm gold
  "#9F7F14", // dark gold
  "#F0D98A", // pale highlight
];

export default function DisplayPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  // ✅ Bulletproof origin detection for Vercel
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const voteUrl = origin ? `${origin}/vote/${encodeURIComponent(code)}` : "";

  const totalVotes = useMemo(() => {
    let t = 0;
    counts.forEach((v) => (t += v));
    return t;
  }, [counts]);

  const chartData = useMemo(() => {
    return options.map((o) => ({
      name: o.name,
      value: counts.get(o.id) ?? 0,
    }));
  }, [options, counts]);

  async function load() {
    const s = await fetchSessionByCode(code);
    setSession(s);

    const o = await fetchOptions(s.id);
    setOptions(o);

    const c = await fetchVoteCounts(s.id);
    setCounts(c);
  }

  useEffect(() => {
    load();

    // 🔴 Live updates
    const channel = supabase
      .channel(`display-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, async () => {
        try {
          const s = await fetchSessionByCode(code);
          const c = await fetchVoteCounts(s.id);
          setCounts(c);
        } catch {
          // ignore transient errors
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <main className="h-screen overflow-hidden vote-bg text-white px-8 py-6">
      <div className="h-full max-w-6xl mx-auto flex flex-col">
        {/* Header */}
        <div className="flex justify-center items-center pb-4">
          <Image
            src="/title.png"
            alt="Kehoes Voting Title"
            width={1000}
            height={240}
            priority
            className="w-[min(900px,85vw)] h-auto max-h-[16vh] object-contain"
          />
        </div>

        {/* Body */}
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
          {/* LEFT: QR */}
          <div className="col-span-4 rounded-2xl bg-gold-inner p-6 flex flex-col min-h-0 items-center">
            <div className="text-gold text-2xl font-bold self-start">
              Vote now
            </div>

            <div className="mt-6 bg-white rounded-xl p-5">
              {voteUrl ? <QRCode value={voteUrl} size={240} /> : null}
            </div>

            {/* ❌ URL TEXT REMOVED (as requested) */}

            <div className="mt-auto pt-4 text-white/70 text-sm">
              Total votes:{" "}
              <span className="text-white font-bold">{totalVotes}</span>
              {session?.is_open === false ? " • Voting closed" : ""}
            </div>
          </div>

          {/* RIGHT: PIE */}
          <div className="col-span-8 rounded-2xl bg-gold-inner p-6 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <div className="text-gold text-2xl font-bold">
                Live Results
              </div>
            </div>

            <div className="mt-4 flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={chartData}
                    outerRadius="82%"
                    label
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={2}
                  >
                    {chartData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={GOLD_COLORS[idx % GOLD_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
