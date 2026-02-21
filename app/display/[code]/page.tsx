"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchOptions, fetchSessionByCode, fetchVoteCounts } from "@/lib/results";
import QRCode from "qrcode.react";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

type OptionRow = { id: string; name: string; sort: number };
type SessionRow = { id: string; code: string; title: string | null; is_open: boolean };

export default function DisplayPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const voteUrl = `${baseUrl}/vote/${encodeURIComponent(code)}`;

  const totalVotes = useMemo(() => {
    let t = 0;
    counts.forEach((v) => (t += v));
    return t;
  }, [counts]);

  const chartData = useMemo(() => {
    return options.map((o) => ({
      name: o.name,
      value: counts.get(o.id) ?? 0
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

    const channel = supabase
      .channel(`display-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, async () => {
        const s = await fetchSessionByCode(code);
        const c = await fetchVoteCounts(s.id);
        setCounts(c);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <main className="min-h-screen vote-bg text-white px-10 py-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-10">
        <div className="flex justify-center">
          <Image
            src="/title.png"
            alt="Kehoes Voting Title"
            width={1000}
            height={240}
            priority
            className="w-[min(1000px,100%)] h-auto"
          />
        </div>

        <div className="grid grid-cols-12 gap-8 items-stretch">
          <div className="col-span-4 rounded-2xl bg-gold-inner p-8 flex flex-col justify-between">
            <div>
              <div className="text-gold text-2xl font-bold">Vote now</div>
              <div className="mt-2 text-white/85">
                Scan the QR code or go to:
                <div className="mt-2 break-all text-white font-semibold">{voteUrl}</div>
              </div>
            </div>

            <div className="mt-6 bg-white rounded-xl p-4 w-fit">
              <QRCode value={voteUrl} size={240} />
            </div>

            <div className="mt-6 text-white/70 text-sm">
              Total votes: <span className="text-white font-bold">{totalVotes}</span>
              {session?.is_open === false ? " • Voting closed" : ""}
            </div>
          </div>

          <div className="col-span-8 rounded-2xl bg-gold-inner p-8">
            <div className="flex items-center justify-between">
              <div className="text-gold text-2xl font-bold">Live Results</div>
              <div className="text-white/70 text-sm">Updates automatically</div>
            </div>

            <div className="mt-6 h-[520px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={chartData} outerRadius={200} label>
                    {chartData.map((_, idx) => (
                      <Cell key={idx} />
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
