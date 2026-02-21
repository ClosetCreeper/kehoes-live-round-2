"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchOptions, fetchSessionByCode, fetchVoteCounts } from "@/lib/results";
import { POSTERS } from "@/lib/posters";
import QRCode from "qrcode.react";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

type OptionRow = { id: string; name: string; sort: number };
type SessionRow = { id: string; code: string; title: string | null; is_open: boolean };

// Gold palette (auto cycles if you have more options than colors)
const GOLD_COLORS = ["#E7C873", "#D4AF37", "#C5A028", "#B8961E", "#9F7F14", "#F0D98A"];

function renderSliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) {
  // Only show labels for non-zero slices
  if (!value || value <= 0) return null;

  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontWeight: 800, fontSize: 18 }}
    >
      {value}
    </text>
  );
}

export default function DisplayPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  // QR origin (works on Vercel previews + prod)
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => setOrigin(window.location.origin), []);
  const voteUrl = origin ? `${origin}/vote/${encodeURIComponent(code)}` : "";

  // Posters
  const [posterIdx, setPosterIdx] = useState(0);
  const [posterVisible, setPosterVisible] = useState(true);
  const posters = POSTERS;

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

  // Cycle posters every 5 seconds with fade
  useEffect(() => {
    if (!posters || posters.length <= 1) return;

    const interval = setInterval(() => {
      setPosterVisible(false);
      setTimeout(() => {
        setPosterIdx((i) => (i + 1) % posters.length);
        setPosterVisible(true);
      }, 250);
    }, 5000);

    return () => clearInterval(interval);
  }, [posters]);

  // Load + realtime + backup refresh
  useEffect(() => {
    load();

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

    // Backup refresh every 5s (data only, no page reload)
    const refresh = setInterval(() => {
      load();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const currentPoster = posters?.length ? `/posters/${posters[posterIdx]}` : null;

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
          {/* LEFT: Posters + QR */}
          <div className="col-span-4 rounded-2xl bg-gold-inner p-6 flex flex-col min-h-0 items-center">
            <div className="text-gold text-2xl font-bold self-start">Vote now</div>

            {/* Poster slot */}
            <div className="mt-4 w-full">
              <div className="text-white/70 text-sm mb-2">Now Showing</div>

              <div className="relative w-full rounded-xl overflow-hidden bg-black/40 border border-white/10 aspect-[2/3]">
                {currentPoster ? (
                  <Image
                    src={currentPoster}
                    alt="Movie poster"
                    fill
                    sizes="(max-width: 1024px) 30vw, 25vw"
                    className={`object-cover transition-opacity duration-300 ${
                      posterVisible ? "opacity-100" : "opacity-0"
                    }`}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm px-4 text-center">
                    Add poster files to <b className="mx-1">public/posters</b> and list them in{" "}
                    <b className="mx-1">lib/posters.ts</b>
                  </div>
                )}
              </div>
            </div>

            {/* QR */}
            <div className="mt-5 bg-white rounded-xl p-4">
              {voteUrl ? <QRCode value={voteUrl} size={210} /> : null}
            </div>

            <div className="mt-auto pt-4 text-white/70 text-sm self-start">
              Total votes: <span className="text-white font-bold">{totalVotes}</span>
              {session?.is_open === false ? " • Voting closed" : ""}
            </div>
          </div>

          {/* RIGHT: Pie */}
          <div className="col-span-8 rounded-2xl bg-gold-inner p-6 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <div className="text-gold text-2xl font-bold">Live Results</div>
              <div className="text-white/60 text-sm">Auto refresh: 5s</div>
            </div>

            <div className="mt-4 flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={chartData}
                    outerRadius="82%"
                    innerRadius="45%"
                    label={renderSliceLabel}
                    labelLine={false}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={2}
                  >
                    {chartData.map((_, idx) => (
                      <Cell key={idx} fill={GOLD_COLORS[idx % GOLD_COLORS.length]} />
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
