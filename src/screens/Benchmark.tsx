import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useServerStore } from "../stores/useServersStore";
import { useTestServer, useSetDns } from "../hooks/useDns";
import { useBestInterface } from "../hooks/useInterfaces";
import type { InstalledApp } from "../types";

type BenchmarkResult = {
    server: string;
    domain: string;
    success: boolean;
    latency: number;
    jitter: number;
    samples: number;
    tcpLatency?: number;
    error: string | null;
};

const APP_PROFILES: Record<string, string[]> = {
    unideva: ["unideva.com", "login-prod.unideva.com", "login.unideva.com"],
    steam: ["steamcontent.com", "steampowered.com", "valve.net"],
    discord: ["discord.com", "discordapp.com", "discord.gg"],
    epic: ["epicgames.com", "unrealengine.com"],
    valorant: ["riotgames.com", "valorant.com"],
    netflix: ["netflix.com", "nflxvideo.net"],
    zoom: ["zoom.us", "zoomgov.com"],
    teams: ["teams.microsoft.com", "office.com"],
};

function profileFor(appName: string, custom: Record<string, string[]> = {}): string[] {
    const lower = appName.toLowerCase();
    const merged = { ...APP_PROFILES, ...custom };
    for (const key of Object.keys(merged)) {
        if (lower.includes(key)) return merged[key];
    }
    return [];
}

export default function Benchmark() {
    const servers = useServerStore((s) => s.servers);
    const loadServers = useServerStore((s) => s.load);
    useEffect(() => {
        if (servers.length === 0) loadServers();
    }, [servers.length, loadServers]);
    const [apps, setApps] = useState<InstalledApp[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [domainsByApp, setDomainsByApp] = useState<Record<string, string>>({});
    const [scanning, setScanning] = useState(false);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<BenchmarkResult[]>([]);
    const [showAllRanking, setShowAllRanking] = useState(false);
    const [capturedDomains, setCapturedDomains] = useState("");
    const [customProfiles, setCustomProfiles] = useState<Record<string, string[]>>(() => {
        try {
            return JSON.parse(localStorage.getItem("benchmark_profiles") || "{}");
        } catch {
            return {};
        }
    });
    const [newProfileKey, setNewProfileKey] = useState("");
    const [newProfileDomains, setNewProfileDomains] = useState("");
    const [measureTcp, setMeasureTcp] = useState(false);
    const [sampleCount, setSampleCount] = useState(3);
    const [applying, setApplying] = useState(false);
    const [applyMsg, setApplyMsg] = useState("");

    const testServer = useTestServer();
    const setDns = useSetDns();
    const bestIface = useBestInterface();

    const scan = async () => {
        setScanning(true);
        try {
            const list = await invoke<InstalledApp[]>("list_installed_apps");
            setApps(list);
            // preselect apps that have a known profile
            const pre = new Set<string>();
            const doms: Record<string, string> = {};
            for (const app of list) {
                const prof = profileFor(app.name, customProfiles);
                if (prof.length) {
                    pre.add(app.name);
                    doms[app.name] = prof.join(", ");
                }
            }
            setSelected(pre);
            setDomainsByApp(doms);
        } finally {
            setScanning(false);
        }
    };

    const toggle = (name: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const run = async () => {
        setRunning(true);
        setResults([]);
        const collected: BenchmarkResult[] = [];
        for (const appName of selected) {
            const raw = (domainsByApp[appName] || "").trim() || capturedDomains;
            const domains = raw
                .split(",")
                .map((d) => d.trim())
                .filter(Boolean);
            if (domains.length === 0) continue;
            for (const server of servers) {
                const serverAddress = server.servers[0];
                if (!serverAddress) continue;
                for (const domain of domains) {
                    try {
                        const latencies: number[] = [];
                        let lastError: string | null = null;
                        let successCount = 0;
                        for (let i = 0; i < Math.max(1, sampleCount); i++) {
                            try {
                                const r = await testServer.mutateAsync({
                                    server: serverAddress,
                                    domain,
                                });
                                if (r.success) {
                                    latencies.push(r.latency);
                                    successCount++;
                                } else if (r.error) {
                                    lastError = r.error;
                                }
                            } catch (e) {
                                lastError = String(e);
                            }
                        }
                        const avg = latencies.length
                            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
                            : 0;
                        const jitter = latencies.length
                            ? Math.max(...latencies) - Math.min(...latencies)
                            : 0;
                        let tcpLatency: number | undefined;
                        if (measureTcp) {
                            try {
                                tcpLatency = await invoke<number>("test_tcp_connect", {
                                    host: domain,
                                    port: 443,
                                });
                            } catch {
                                tcpLatency = undefined;
                            }
                        }
                        collected.push({
                            server: server.name,
                            domain,
                            success: successCount > 0,
                            latency: avg,
                            jitter,
                            samples: Math.max(1, sampleCount),
                            tcpLatency,
                            error: successCount > 0 ? null : lastError,
                        });
                    } catch (e) {
                        collected.push({
                            server: server.name,
                            domain,
                            success: false,
                            latency: 0,
                            jitter: 0,
                            samples: Math.max(1, sampleCount),
                            error: String(e),
                        });
                    }
                    setResults([...collected]);
                }
            }
        }
        setRunning(false);
    };

    // aggregate by server
    const aggregate: Record<string, { total: number; count: number; fails: number; jitterTotal: number }> = {};
    for (const r of results) {
        if (!aggregate[r.server]) aggregate[r.server] = { total: 0, count: 0, fails: 0, jitterTotal: 0 };
        if (r.success) {
            aggregate[r.server].total += r.latency;
            aggregate[r.server].jitterTotal += r.jitter;
            aggregate[r.server].count += 1;
        } else {
            aggregate[r.server].fails += 1;
        }
    }
    const ranking = Object.entries(aggregate)
        .map(([server, v]) => ({
            server,
            avg: v.count ? Math.round(v.total / v.count) : 0,
            jitter: v.count ? Math.round(v.jitterTotal / v.count) : 0,
            success: v.count,
            fails: v.fails,
        }))
        .sort((a, b) => {
            const aFailed = a.success === 0 && a.fails > 0;
            const bFailed = b.success === 0 && b.fails > 0;
            if (aFailed !== bFailed) return aFailed ? 1 : -1;
            if (a.avg !== b.avg) return a.avg - b.avg;
            if (a.jitter !== b.jitter) return a.jitter - b.jitter;
            return b.success - a.success;
        });
    const visibleRanking = showAllRanking ? ranking : ranking.slice(0, 10);

    return (
        <div className="absolute left-20 inner-container-size bg-zinc-900/50 rounded-2xl flex flex-col overflow-y-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">DNS Benchmark (Uygulama Bazlı)</h1>
            <div className="flex gap-2">
                <button
                    className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                    onClick={scan}
                    disabled={scanning}
                >
                    {scanning ? "Taranıyor..." : "Kurulu Uygulamaları Tara"}
                </button>
                <button
                    className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                    onClick={run}
                    disabled={running || selected.size === 0 || servers.length === 0}
                >
                    {running ? "Test ediliyor..." : "Benchmark Çalıştır"}
                </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <button
                    className="px-3 py-1 rounded bg-purple-600 text-white text-sm"
                    onClick={async () => {
                        try {
                            const logs = await invoke<any[]>("get_dns_logs", { limit: 500 });
                            const set = new Set<string>();
                            for (const l of logs) if (l.domain) set.add(l.domain);
                            setCapturedDomains(Array.from(set).join(", "));
                        } catch {
                            setCapturedDomains("");
                        }
                    }}
                >
                    DNS log'tan yakala
                </button>
                <label className="flex items-center gap-1 text-sm">
                    <input
                        type="checkbox"
                        checked={measureTcp}
                        onChange={(e) => setMeasureTcp(e.target.checked)}
                    />
                    TCP bağlantısını da ölç
                </label>
                <label className="flex items-center gap-1 text-sm">
                    Tekrar:
                    <input
                        type="number"
                        min={1}
                        max={10}
                        className="border rounded px-2 py-1 text-sm w-16"
                        value={sampleCount}
                        onChange={(e) => setSampleCount(Number(e.target.value) || 1)}
                    />
                </label>
                <button
                    className="px-3 py-1 rounded bg-zinc-700 text-white text-sm"
                    onClick={() => {
                        const key = newProfileKey.trim().toLowerCase();
                        const domains = newProfileDomains
                            .split(",")
                            .map((d) => d.trim())
                            .filter(Boolean);
                        if (!key || domains.length === 0) return;
                        const next = { ...customProfiles, [key]: domains };
                        setCustomProfiles(next);
                        localStorage.setItem("benchmark_profiles", JSON.stringify(next));
                        setNewProfileKey("");
                        setNewProfileDomains("");
                    }}
                >
                    Profil ekle
                </button>
                <input
                    className="border rounded px-2 py-1 text-sm w-40"
                    placeholder="uygulama adı"
                    value={newProfileKey}
                    onChange={(e) => setNewProfileKey(e.target.value)}
                />
                <input
                    className="border rounded px-2 py-1 text-sm w-64"
                    placeholder="domain1.com, domain2.com"
                    value={newProfileDomains}
                    onChange={(e) => setNewProfileDomains(e.target.value)}
                />
            </div>

            {capturedDomains && (
                <div className="text-xs text-zinc-400">
                    Yakalanan domainler: {capturedDomains}
                </div>
            )}

            {apps.length > 0 && (
                <div className="border rounded p-4 max-h-60 overflow-auto space-y-2">
                    {apps.map((app) => (
                        <div key={app.name} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={selected.has(app.name)}
                                onChange={() => toggle(app.name)}
                            />
                            <span className="flex-1">{app.name}</span>
                            {selected.has(app.name) && (
                                <input
                                    className="border rounded px-2 py-1 text-sm w-64"
                                    placeholder="domain1.com, domain2.com"
                                    value={domainsByApp[app.name] || ""}
                                    onChange={(e) =>
                                        setDomainsByApp((prev) => ({
                                            ...prev,
                                            [app.name]: e.target.value,
                                        }))
                                    }
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {ranking.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-2">Sonuç Sıralaması</h2>
                    <div className="max-h-72 overflow-auto border rounded">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-zinc-700 text-white">
                                    <th className="p-2 text-left">Sıra</th>
                                    <th className="p-2 text-left">DNS</th>
                                    <th className="p-2 text-left">Ort. Gecikme (ms)</th>
<th className="p-2 text-left">Jitter (ms)</th>
                                    <th className="p-2 text-left">Başarılı</th>
                                    <th className="p-2 text-left">Başarısız</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRanking.map((r, i) => (
                                    <tr key={r.server} className="border-t">
                                        <td className="p-2">{i === 0 && r.success > 0 ? "🏆" : i + 1}</td>
                                        <td className="p-2">{r.server}</td>
                                        <td className="p-2">{r.success ? r.avg : "—"}</td>
<td className="p-2">{r.success ? r.jitter : "—"}</td>
                                        <td className="p-2">{r.success}</td>
                                        <td className="p-2">{r.fails}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {ranking.length > 10 && (
                        <button
                            className="mt-2 text-sm text-blue-400 hover:underline"
                            onClick={() => setShowAllRanking((v) => !v)}
                        >
                            {showAllRanking
                                ? "Daha az göster"
                                : `Daha fazla göster (${ranking.length - 10} daha)`}
                        </button>
                    )}
                    {ranking.length > 0 && (
                        <button
                            className="mt-3 px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                            disabled={applying || !bestIface.data}
                            onClick={async () => {
                                setApplying(true);
                                setApplyMsg("");
                                try {
                                    const bestName = ranking[0].server;
                                    const srv = servers.find((s) => s.name === bestName);
                                    if (!srv || !srv.servers[0]) throw new Error("server not found");
                                    const iface = bestIface.data;
                                    if (!iface) throw new Error("no interface");
                                    await setDns.mutateAsync({
                                        interface_index: iface.interface_index,
                                        dns_servers: srv.servers,
                                        dns_type: srv.type,
                                    });
                                    setApplyMsg(`Uygulandı: ${bestName} (${iface.name})`);
                                } catch (e) {
                                    setApplyMsg(`Hata: ${String(e)}`);
                                } finally {
                                    setApplying(false);
                                }
                            }}
                        >
                            {applying ? "Uygulanıyor..." : "En iyi DNS'i uygula"}
                        </button>
                    )}
                    {applyMsg && <div className="mt-2 text-sm text-zinc-300">{applyMsg}</div>}
                </div>
            )}

            {results.length > 0 && (
                <div className="flex gap-2">
                    <button
                        className="px-3 py-1 rounded bg-zinc-700 text-white text-sm"
                        onClick={() => {
                            const blob = new Blob([JSON.stringify(results, null, 2)], {
                                type: "application/json",
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "benchmark-results.json";
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                    >
                        JSON indir
                    </button>
                    <button
                        className="px-3 py-1 rounded bg-zinc-700 text-white text-sm"
                        onClick={() => {
                            const header = "server,domain,success,latency,jitter,samples,tcpLatency,error";
                            const rows = results.map((r) =>
                                [
                                    r.server,
                                    r.domain,
                                    r.success,
                                    r.latency,
                                    r.jitter,
                                    r.samples,
                                    r.tcpLatency ?? "",
                                    (r.error || "").replace(/,/g, ";"),
                                ].join(",")
                            );
                            const blob = new Blob([[header, ...rows].join("\n")], {
                                type: "text/csv",
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "benchmark-results.csv";
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                    >
                        CSV indir
                    </button>
                </div>
            )}

            {results.length > 0 && (
                <details className="border rounded p-4">
                    <summary className="cursor-pointer font-semibold">
                        Detaylı Sonuçlar ({results.length})
                    </summary>
                    <table className="w-full border mt-2 text-sm">
                        <thead>
                            <tr className="bg-zinc-700 text-white">
                                <th className="p-2 text-left">DNS</th>
                                <th className="p-2 text-left">Domain</th>
                                <th className="p-2 text-left">Durum</th>
                                <th className="p-2 text-left">DNS (ms)</th>
                                {measureTcp && <th className="p-2 text-left">TCP (ms)</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => (
                                <tr key={i} className="border-t">
                                    <td className="p-2">{r.server}</td>
                                    <td className="p-2">{r.domain}</td>
                                    <td className="p-2">{r.success ? "✅" : "❌"}</td>
                                    <td className="p-2">{r.latency}</td>
                                    {measureTcp && <td className="p-2">{r.tcpLatency ?? "—"}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </details>
            )}
        </div>
    );
}