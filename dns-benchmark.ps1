# dns-benchmark.ps1
# Portable DNS benchmark - calistirmak icin PowerShell'de:
#   powershell -ExecutionPolicy Bypass -File .\dns-benchmark.ps1
# Gereksinim: PowerShell 5.1+, internet baglantisi.

param(
    [string]$Domain = "",
    [int]$Samples = 3
)

if ([string]::IsNullOrWhiteSpace($Domain)) {
    $Domain = Read-Host "Test edilecek domain (ornek: login-prod.unideva.com)"
    if ([string]::IsNullOrWhiteSpace($Domain)) { $Domain = "login-prod.unideva.com" }
}

$servers = @(
    @{ Name = "Cloudflare";     Address = "1.1.1.1" },
    @{ Name = "Google";         Address = "8.8.8.8" },
    @{ Name = "Quad9";          Address = "9.9.9.9" },
    @{ Name = "OpenDNS";        Address = "208.67.222.222" },
    @{ Name = "CleanBrowsing";  Address = "185.228.168.9" },
    @{ Name = "ControlD";       Address = "76.76.19.19" }
)

Write-Host ""
Write-Host "Domain: $Domain  |  Ornek sayisi: $Samples" -ForegroundColor Cyan
Write-Host ("{0,-16} {1,10} {2,10} {3,10} {4,10}" -f "DNS","Ort(ms)","Jitter","Basarili","Basarisiz")
Write-Host ("-" * 62)

$results = @()
foreach ($s in $servers) {
    $latencies = @()
    $fails = 0
    for ($i = 0; $i -lt $Samples; $i++) {
        $t = Measure-Command {
            try {
                Resolve-DnsName -Name $Domain -Server $s.Address -Type A -ErrorAction Stop | Out-Null
            } catch { }
        }
        # Resolve-DnsName basarisizsa Measure-Command suresi ~timeout; basari kontrolu icin tekrar
        try {
            $null = Resolve-DnsName -Name $Domain -Server $s.Address -Type A -ErrorAction Stop
            $latencies += [int]$t.TotalMilliseconds
        } catch {
            $fails++
        }
    }
    $avg = if ($latencies.Count -gt 0) { [int]($latencies | Measure-Object -Average).Average } else { 0 }
    $jitter = if ($latencies.Count -gt 1) { ($latencies | Measure-Object -Maximum).Maximum - ($latencies | Measure-Object -Minimum).Minimum } else { 0 }
    $results += [pscustomobject]@{
        Name = $s.Name
        Address = $s.Address
        Avg = $avg
        Jitter = $jitter
        Success = $latencies.Count
        Fails = $fails
    }
    Write-Host ("{0,-16} {1,10} {2,10} {3,10} {4,10}" -f $s.Name, $avg, $jitter, $latencies.Count, $fails)
}

Write-Host ""
$best = $results | Where-Object { $_.Success -gt 0 } | Sort-Object Avg, Jitter | Select-Object -First 1
if ($best) {
    Write-Host ("En iyi: {0} ({1}) - {2} ms (jitter {3} ms)" -f $best.Name, $best.Address, $best.Avg, $best.Jitter) -ForegroundColor Green
} else {
    Write-Host "Hicbir DNS basarili olamadi." -ForegroundColor Red
}

# CSV kaydet
$out = "dns-benchmark-result.csv"
$results | Export-Csv -Path $out -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "Sonuc kaydedildi: $out" -ForegroundColor Yellow