import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  Download,
  FileCheck2,
  Filter,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMipc } from "@/context/MipcStore";
import { downloadTechnicalBulletinPdf } from "@/lib/bulletinPdf";
import {
  addDaysToIsoDate,
  classifyWaterStatus,
  computeBulletinIndicators,
  computeMetricStats,
  filterReadingsByDateRange,
  formatCoordinatesWGS84,
  formatDateBR,
  formatDecimalBR,
  generateIntegrityHash,
  isValidWaterTemperature,
} from "@/lib/waterRules";
import type { SensorReading, WaterStatus } from "@/types/mipc";
import { WellsMap } from "@/components/WellsMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIOD_PRESETS = [
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 90 dias", days: 90 },
];

type StatusFilter = "Todos" | WaterStatus;
type ParamFilter =
  | "all"
  | "ph_critical"
  | "ph_attention"
  | "turbidity_attention"
  | "turbidity_critical"
  | "temp_critical";
type SortField = "timestamp" | "ph" | "turbidity" | "temperature" | "reservoirLevel";
type SortDir = "asc" | "desc";

function matchesParamFilter(r: SensorReading, filter: ParamFilter): boolean {
  switch (filter) {
    case "ph_critical":
      return r.ph < 6.0 || r.ph > 9.5;
    case "ph_attention":
      return r.ph < 6.5 || r.ph > 9.0;
    case "turbidity_attention":
      return r.turbidity >= 4.0;
    case "turbidity_critical":
      return r.turbidity >= 5.0;
    case "temp_critical":
      return r.temperature >= 25.0;
    default:
      return true;
  }
}

function statusBadgeVariant(status: WaterStatus): "critical" | "attention" | "excellent" {
  if (status === "Crítico") return "critical";
  if (status === "Atenção") return "attention";
  return "excellent";
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BulletinsPage() {
  const { wells, maintenances, bulletins, addBulletin } = useMipc();

  const today = new Date().toISOString().slice(0, 10);
  const [wellId, setWellId] = useState(wells[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(() =>
    addDaysToIsoDate(today, -30)
  );
  const [periodEnd, setPeriodEnd] = useState(today);

  // Table filter, sort & row selection state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [paramFilter, setParamFilter] = useState<ParamFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedReadingIds, setSelectedReadingIds] = useState<string[]>([]);

  // History filter
  const [historySearch, setHistorySearch] = useState("");

  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedWell = wells.find((w) => w.id === wellId) ?? wells[0];

  const periodReadings = useMemo(() => {
    if (!selectedWell) return [];
    return filterReadingsByDateRange(
      selectedWell.history,
      periodStart,
      periodEnd
    );
  }, [selectedWell, periodStart, periodEnd]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      Todos: periodReadings.length,
      Crítico: 0,
      Atenção: 0,
      Excelente: 0,
    };
    for (const r of periodReadings) {
      counts[classifyWaterStatus(r)] += 1;
    }
    return counts;
  }, [periodReadings]);

  const filteredReadings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = periodReadings.filter((r) => {
      const status = classifyWaterStatus(r);
      if (statusFilter !== "Todos" && status !== statusFilter) return false;
      if (!matchesParamFilter(r, paramFilter)) return false;
      if (q) {
        const haystack = [
          formatDateTimeBR(r.timestamp),
          formatDecimalBR(r.ph, 2),
          formatDecimalBR(r.turbidity, 2),
          formatDecimalBR(r.temperature, 1),
          status,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortField === "timestamp") {
        diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else {
        diff = a[sortField] - b[sortField];
      }
      return sortDir === "asc" ? diff : -diff;
    });
  }, [periodReadings, statusFilter, paramFilter, searchQuery, sortField, sortDir]);

  // Keep only selected IDs that still exist in current periodReadings
  const validSelectedSet = useMemo(() => {
    const periodIdSet = new Set(periodReadings.map((r) => r.id));
    return new Set(selectedReadingIds.filter((id) => periodIdSet.has(id)));
  }, [periodReadings, selectedReadingIds]);

  const hasActiveTableFilters =
    statusFilter !== "Todos" || paramFilter !== "all" || searchQuery.trim().length > 0;

  // Readings that feed the statistical summary, chart, and exported PDF
  const activeReadings = useMemo(() => {
    const base =
      validSelectedSet.size > 0
        ? periodReadings.filter((r) => validSelectedSet.has(r.id))
        : filteredReadings;
    return [...base].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [periodReadings, filteredReadings, validSelectedSet]);

  const allVisibleSelected =
    filteredReadings.length > 0 &&
    filteredReadings.every((r) => validSelectedSet.has(r.id));

  const periodMaintenances = useMemo(() => {
    if (!selectedWell) return [];
    const startMs = new Date(`${periodStart}T00:00:00`).getTime();
    const endMs = new Date(`${periodEnd}T23:59:59.999`).getTime();
    return maintenances.filter((m) => {
      if (m.wellId !== selectedWell.id) return false;
      const t = new Date(m.createdAt).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [maintenances, selectedWell, periodStart, periodEnd]);

  const anomalies = useMemo(
    () => activeReadings.filter((r) => classifyWaterStatus(r) !== "Excelente"),
    [activeReadings]
  );

  const stats = useMemo(() => {
    const validTemps = activeReadings
      .map((r) => r.temperature)
      .filter((t) => isValidWaterTemperature(t));
    return {
      ph: computeMetricStats(activeReadings.map((r) => r.ph)),
      turbidity: computeMetricStats(activeReadings.map((r) => r.turbidity)),
      temperature: computeMetricStats(
        validTemps.length > 0 ? validTemps : activeReadings.map((r) => r.temperature)
      ),
    };
  }, [activeReadings]);

  const indicators = useMemo(
    () => computeBulletinIndicators(activeReadings),
    [activeReadings]
  );

  const paramSummaryStatus = useMemo(() => {
    if (activeReadings.length === 0) {
      return {
        ph: "Excelente" as WaterStatus,
        turbidity: "Excelente" as WaterStatus,
        temperature: "Excelente" as WaterStatus,
      };
    }
    const phStatus: WaterStatus =
      stats.ph.min < 6.0 || stats.ph.max > 9.5
        ? "Crítico"
        : stats.ph.min < 6.5 || stats.ph.max > 9.0
          ? "Atenção"
          : "Excelente";
    const turbStatus: WaterStatus =
      stats.turbidity.max >= 5.0
        ? "Crítico"
        : stats.turbidity.max >= 4.0
          ? "Atenção"
          : "Excelente";
    const tempStatus: WaterStatus =
      stats.temperature.max >= 25.0 ? "Crítico" : "Excelente";
    return { ph: phStatus, turbidity: turbStatus, temperature: tempStatus };
  }, [activeReadings.length, stats]);

  const chartData = useMemo(
    () =>
      activeReadings.map((r) => ({
        date: new Date(r.timestamp).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        turbidez: r.turbidity,
        ph: r.ph,
        temperatura: r.temperature,
      })),
    [activeReadings]
  );

  const filteredBulletins = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return bulletins;
    return bulletins.filter((b) =>
      `${b.protocolCode} ${b.wellName} ${b.issuerName} ${b.integrityHash}`
        .toLowerCase()
        .includes(q)
    );
  }, [bulletins, historySearch]);

  function applyPreset(days: number) {
    setPeriodStart(addDaysToIsoDate(today, -days));
    setPeriodEnd(today);
    setSelectedReadingIds([]);
    setErrorAlert(null);
  }

  function resetTableFilters() {
    setStatusFilter("Todos");
    setParamFilter("all");
    setSearchQuery("");
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "timestamp" ? "desc" : "desc");
    }
  }

  function toggleRowSelection(id: string) {
    setSelectedReadingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredReadings.map((r) => r.id);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedReadingIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedReadingIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-orange-300" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-orange-300" />
    );
  }

  async function handleGenerateBulletin() {
    setErrorAlert(null);
    setSuccessAlert(null);

    if (!selectedWell) return;

    // Exact BDD HU-MIPC-03 Scenario 2 validation: block when no valid readings exist in period/selection
    if (activeReadings.length === 0) {
      setErrorAlert(
        "Não existem medições válidas cadastradas para o período selecionado. Ajuste o filtro de datas para prosseguir"
      );
      return;
    }

    setIsGenerating(true);
    try {
      const generatedAt = new Date().toISOString();
      const payload = JSON.stringify({
        wellId: selectedWell.id,
        periodStart,
        periodEnd,
        readings: activeReadings.map((r) => [
          r.timestamp,
          r.ph,
          r.turbidity,
          r.temperature,
        ]),
        generatedAt,
      });
      const integrityHash = await generateIntegrityHash(payload);

      const created = addBulletin({
        wellId: selectedWell.id,
        wellName: selectedWell.name,
        community: selectedWell.community,
        coordinates: formatCoordinatesWGS84(
          selectedWell.latitude,
          selectedWell.longitude
        ),
        periodStart,
        periodEnd,
        issuerId: "FISC-014",
        issuerName: "Mariana Souza",
        integrityHash,
        readingsCount: activeReadings.length,
        criticalAlertsCount: anomalies.filter(
          (a) => classifyWaterStatus(a) === "Crítico"
        ).length,
        maintenancesCount: periodMaintenances.length,
      });

      downloadTechnicalBulletinPdf({
        protocolCode: created.protocolCode,
        well: selectedWell,
        periodStart,
        periodEnd,
        readings: activeReadings,
        maintenances: periodMaintenances,
        issuerId: created.issuerId,
        issuerName: created.issuerName,
        integrityHash,
        generatedAt: created.generatedAt,
      });

      setSuccessAlert(
        `Boletim Técnico ${created.protocolCode} gerado em PDF com ${activeReadings.length} medição(ões) e hash SHA-256 registrado no histórico.`
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Evidência Georreferenciada e Protocolo Oficial
        </span>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-blue-900">
          Emissão de Boletins Técnicos para Órgãos Públicos
        </h1>
        <p className="mt-1 text-sm text-purple-900">
          Consolide medições históricas, anomalias e manutenções em relatório
          PDF assinado com hash de integridade para CAESB, ANVISA, SES-DF e
          IBRAM.
        </p>
      </div>

      {errorAlert && <FeedbackBanner variant="error" message={errorAlert} />}

      {successAlert && (
        <FeedbackBanner
          variant="success"
          message={successAlert}
          onDismiss={() => setSuccessAlert(null)}
        />
      )}

      {/* Configuration Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros do Boletim Técnico</CardTitle>
          <CardDescription>
            Escolha o poço e o intervalo de datas para pré-visualizar, filtrar e
            exportar o relatório oficial em PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5 min-w-0 md:col-span-2">
              <Label htmlFor="bol-well">Unidade / Poço Monitorado</Label>
              <Select
                value={wellId}
                onValueChange={(v) => {
                  setWellId(v);
                  setSelectedReadingIds([]);
                  resetTableFilters();
                  setErrorAlert(null);
                }}
              >
                <SelectTrigger id="bol-well">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {wells.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.history.length} leituras)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="bol-start">Data Inicial</Label>
              <Input
                id="bol-start"
                type="date"
                value={periodStart}
                onChange={(e) => {
                  setPeriodStart(e.target.value);
                  setSelectedReadingIds([]);
                  setErrorAlert(null);
                }}
              />
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="bol-end">Data Final</Label>
              <Input
                id="bol-end"
                type="date"
                value={periodEnd}
                onChange={(e) => {
                  setPeriodEnd(e.target.value);
                  setSelectedReadingIds([]);
                  setErrorAlert(null);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-purple-500 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-purple-900">
                Atalhos de período:
              </span>
              {PERIOD_PRESETS.map((p) => (
                <Button
                  key={p.days}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset(p.days)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <Button
              type="button"
              size="lg"
              disabled={isGenerating}
              onClick={handleGenerateBulletin}
              className="relative"
            >
              <span
                className={
                  isGenerating
                    ? "invisible inline-flex items-center gap-2"
                    : "inline-flex items-center gap-2"
                }
              >
                <Download className="h-4 w-4" />
                {validSelectedSet.size > 0
                  ? `Gerar Boletim (${validSelectedSet.size} selecionadas)`
                  : "Gerar Boletim Técnico (.pdf)"}
              </span>
              {isGenerating && (
                <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PDF...
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview of the Technical Bulletin */}
      {selectedWell && (
        <Card className="overflow-hidden">
          <div className="bg-blue-900 text-white px-6 py-5 border-b-4 border-orange-500 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-orange-400 font-semibold">
                Pré-Visualização do Timbrado Oficial · ONG Fundação Água Limpa
              </p>
              <h2 className="mt-1 font-serif text-xl sm:text-2xl font-bold text-white">
                Boletim Técnico — {selectedWell.name}
              </h2>
              <p className="text-xs text-blue-200 mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                {formatCoordinatesWGS84(
                  selectedWell.latitude,
                  selectedWell.longitude
                )}{" "}
                · Abrangência: ~{selectedWell.affectedFamilies} famílias
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-blue-100 tabular-nums">
              <p className="font-semibold text-white">
                Período: {formatDateBR(periodStart)} a {formatDateBR(periodEnd)}
              </p>
              <p>
                {activeReadings.length} medição(ões) no boletim
                {validSelectedSet.size > 0
                  ? ` (${validSelectedSet.size} selecionada(s) manualmente)`
                  : hasActiveTableFilters
                    ? ` (de ${periodReadings.length} no período)`
                    : ""}
              </p>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {periodReadings.length === 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-950">
                <p className="font-semibold">
                  Nenhuma leitura IoT encontrada para este poço no período
                  selecionado.
                </p>
                <p className="mt-1 text-xs">
                  Ajuste o filtro de datas ou selecione outro poço com medições
                  registradas para emitir o boletim.
                </p>
              </div>
            ) : (
              <>
                {/* Interactive Readings Table with Filters, Sorting & Row Selection */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-lg font-bold text-blue-900 flex items-center gap-2">
                        <Filter className="h-4 w-4 text-blue-500" />
                        Medições do Período — Filtros e Seleção
                      </h3>
                      <p className="text-xs text-purple-900">
                        Filtre por status ou parâmetro e marque medições
                        específicas para compor o resumo estatístico e o PDF.
                      </p>
                    </div>

                    {validSelectedSet.size > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs text-blue-900">
                        <CheckSquare className="h-3.5 w-3.5 text-orange-600" />
                        <span className="font-semibold tabular-nums">
                          {validSelectedSet.size} selecionada(s)
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedReadingIds([])}
                          className="ml-1 inline-flex items-center gap-0.5 font-medium text-blue-700 hover:text-blue-900 underline"
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Filter Toolbar */}
                  <div className="rounded-xl border border-purple-600 bg-purple-100/70 p-3.5 space-y-3">
                    {/* Status pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-blue-900 mr-1">
                        Status:
                      </span>
                      {(["Todos", "Crítico", "Atenção", "Excelente"] as StatusFilter[]).map(
                        (st) => {
                          const active = statusFilter === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setStatusFilter(st)}
                              aria-pressed={active}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                active
                                  ? "bg-blue-900 text-white shadow-xs"
                                  : "bg-white text-blue-900 border border-purple-600 hover:bg-purple-200/70"
                              }`}
                            >
                              <span>{st}</span>
                              <span
                                className={`rounded-full px-1.5 py-0.2 text-[11px] tabular-nums ${
                                  active
                                    ? "bg-orange-500 text-blue-900 font-bold"
                                    : "bg-purple-200 text-blue-900"
                                }`}
                              >
                                {statusCounts[st]}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>

                    {/* Parameter dropdown + search + clear */}
                    <div className="grid gap-3 sm:grid-cols-12 items-end">
                      <div className="sm:col-span-5 space-y-1">
                        <Label htmlFor="table-param-filter" className="text-xs">
                          Critério de parâmetro
                        </Label>
                        <Select
                          value={paramFilter}
                          onValueChange={(v) => setParamFilter(v as ParamFilter)}
                        >
                          <SelectTrigger id="table-param-filter" className="bg-white h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os parâmetros</SelectItem>
                            <SelectItem value="ph_critical">
                              pH crítico (&lt; 6,0 ou &gt; 9,5)
                            </SelectItem>
                            <SelectItem value="ph_attention">
                              pH em oscilação (&lt; 6,5 ou &gt; 9,0)
                            </SelectItem>
                            <SelectItem value="turbidity_attention">
                              Turbidez em atenção/crítica (&gt;= 4,0 UNT)
                            </SelectItem>
                            <SelectItem value="turbidity_critical">
                              Turbidez crítica (&gt;= 5,0 UNT)
                            </SelectItem>
                            <SelectItem value="temp_critical">
                              Temperatura elevada (&gt;= 25,0 °C)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-5 space-y-1">
                        <Label htmlFor="table-search" className="text-xs">
                          Buscar por data, hora ou valor
                        </Label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-800" />
                          <Input
                            id="table-search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ex.: 19/11, 4,1, Atenção..."
                            className="bg-white h-9 pl-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!hasActiveTableFilters}
                          onClick={resetTableFilters}
                          className="w-full h-9 text-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                          Limpar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Readings Table */}
                  {filteredReadings.length === 0 ? (
                    <div className="rounded-xl border border-purple-600 bg-purple-50 p-6 text-center space-y-2">
                      <p className="text-sm font-semibold text-blue-900">
                        Nenhuma medição corresponde aos filtros aplicados.
                      </p>
                      <p className="text-xs text-purple-900">
                        Ajuste o status, parâmetro ou termo de busca para
                        visualizar os registros deste período.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={resetTableFilters}
                      >
                        Limpar filtros da tabela
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-purple-600 bg-white">
                      <div className="overflow-x-auto max-h-[340px]">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="sticky top-0 z-10 bg-blue-900 text-white text-[11px] uppercase tracking-wide">
                            <tr>
                              <th className="w-10 px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  aria-label="Selecionar todas as medições visíveis"
                                  checked={allVisibleSelected}
                                  onChange={toggleSelectAllVisible}
                                  className="h-4 w-4 accent-orange-500 rounded cursor-pointer"
                                />
                              </th>
                              <th
                                className="px-3 py-2.5"
                                aria-sort={
                                  sortField === "timestamp"
                                    ? sortDir === "asc"
                                      ? "ascending"
                                      : "descending"
                                    : "none"
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSort("timestamp")}
                                  className="inline-flex items-center gap-1 hover:text-orange-300"
                                >
                                  Data / Hora
                                  {renderSortIcon("timestamp")}
                                </button>
                              </th>
                              <th
                                className="px-3 py-2.5 text-right"
                                aria-sort={
                                  sortField === "ph"
                                    ? sortDir === "asc"
                                      ? "ascending"
                                      : "descending"
                                    : "none"
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSort("ph")}
                                  className="inline-flex items-center gap-1 hover:text-orange-300 ml-auto"
                                >
                                  pH
                                  {renderSortIcon("ph")}
                                </button>
                              </th>
                              <th
                                className="px-3 py-2.5 text-right"
                                aria-sort={
                                  sortField === "turbidity"
                                    ? sortDir === "asc"
                                      ? "ascending"
                                      : "descending"
                                    : "none"
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSort("turbidity")}
                                  className="inline-flex items-center gap-1 hover:text-orange-300 ml-auto"
                                >
                                  Turbidez (UNT)
                                  {renderSortIcon("turbidity")}
                                </button>
                              </th>
                              <th
                                className="px-3 py-2.5 text-right"
                                aria-sort={
                                  sortField === "temperature"
                                    ? sortDir === "asc"
                                      ? "ascending"
                                      : "descending"
                                    : "none"
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSort("temperature")}
                                  className="inline-flex items-center gap-1 hover:text-orange-300 ml-auto"
                                >
                                  Temp. (°C)
                                  {renderSortIcon("temperature")}
                                </button>
                              </th>
                              <th
                                className="px-3 py-2.5 text-right"
                                aria-sort={
                                  sortField === "reservoirLevel"
                                    ? sortDir === "asc"
                                      ? "ascending"
                                      : "descending"
                                    : "none"
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSort("reservoirLevel")}
                                  className="inline-flex items-center gap-1 hover:text-orange-300 ml-auto"
                                >
                                  Reservatório
                                  {renderSortIcon("reservoirLevel")}
                                </button>
                              </th>
                              <th className="px-3 py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-500">
                            {filteredReadings.map((r, idx) => {
                              const status = classifyWaterStatus(r);
                              const isSelected = validSelectedSet.has(r.id);
                              const phCrit = r.ph < 6.0 || r.ph > 9.5;
                              const phWarn = !phCrit && (r.ph < 6.5 || r.ph > 9.0);
                              const turbCrit = r.turbidity >= 5.0;
                              const turbWarn = !turbCrit && r.turbidity >= 4.0;
                              const tempCrit = r.temperature >= 25.0;

                              return (
                                <tr
                                  key={r.id}
                                  onClick={() => toggleRowSelection(r.id)}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected
                                      ? "bg-orange-50/90 hover:bg-orange-100/70"
                                      : idx % 2 === 1
                                        ? "bg-purple-100/45 hover:bg-purple-200/50"
                                        : "bg-white hover:bg-purple-100/50"
                                  }`}
                                >
                                  <td
                                    className="px-3 py-2.5 text-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      aria-label={`Selecionar leitura de ${formatDateTimeBR(r.timestamp)}`}
                                      checked={isSelected}
                                      onChange={() => toggleRowSelection(r.id)}
                                      className="h-4 w-4 accent-orange-500 rounded cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2.5 font-medium text-blue-900 tabular-nums whitespace-nowrap">
                                    {formatDateTimeBR(r.timestamp)}
                                  </td>
                                  <td
                                    className={`px-3 py-2.5 text-right tabular-nums ${
                                      phCrit
                                        ? "font-bold text-red-600"
                                        : phWarn
                                          ? "font-semibold text-amber-700"
                                          : "text-blue-900"
                                    }`}
                                  >
                                    {formatDecimalBR(r.ph, 2)}
                                  </td>
                                  <td
                                    className={`px-3 py-2.5 text-right tabular-nums ${
                                      turbCrit
                                        ? "font-bold text-red-600"
                                        : turbWarn
                                          ? "font-semibold text-amber-700"
                                          : "text-blue-900"
                                    }`}
                                  >
                                    {formatDecimalBR(r.turbidity, 2)}
                                  </td>
                                  <td
                                    className={`px-3 py-2.5 text-right tabular-nums ${
                                      tempCrit
                                        ? "font-bold text-red-600"
                                        : "text-blue-900"
                                    }`}
                                  >
                                    {formatDecimalBR(r.temperature, 1)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-purple-900">
                                    {r.reservoirLevel}%
                                  </td>
                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    <Badge variant={statusBadgeVariant(status)}>
                                      {status}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-purple-500 bg-purple-100/60 px-4 py-2 text-xs text-purple-900 tabular-nums">
                        <span>
                          Exibindo <strong className="text-blue-900">{filteredReadings.length}</strong> de{" "}
                          <strong className="text-blue-900">{periodReadings.length}</strong> medições no período
                        </span>
                        <span>
                          Clique em qualquer linha para incluir/remover da seleção do boletim
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Executive Indicators + Statistical Summary Table (recomputed dynamically for activeReadings) */}
                {activeReadings.length > 0 && (
                  <>
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                        <h3 className="font-serif text-lg font-bold text-blue-900">
                          Indicadores Executivos (incluídos no PDF)
                        </h3>
                        <span className="text-xs text-purple-900">
                          PDF inclui gráficos vetoriais de Turbidez/pH, Distribuição Sanitária e Temperatura
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-purple-600 bg-white p-3.5 space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                            Conformidade Sanitária
                          </p>
                          <p
                            className={`text-2xl font-bold tabular-nums ${
                              indicators.compliancePct >= 80
                                ? "text-emerald-700"
                                : indicators.compliancePct >= 50
                                  ? "text-amber-700"
                                  : "text-red-600"
                            }`}
                          >
                            {formatDecimalBR(indicators.compliancePct, 1)}%
                          </p>
                          <div className="h-1.5 w-full rounded-full bg-purple-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                indicators.compliancePct >= 80
                                  ? "bg-emerald-600"
                                  : indicators.compliancePct >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-600"
                              }`}
                              style={{ width: `${Math.min(100, indicators.compliancePct)}%` }}
                            />
                          </div>
                          <p className="text-xs text-purple-900 tabular-nums">
                            {indicators.excellentCount} de {indicators.total} leituras Excelentes
                          </p>
                        </div>

                        <div className="rounded-xl border border-purple-600 bg-white p-3.5 space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                            IQA Simplificado
                          </p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-bold tabular-nums text-blue-900">
                              {indicators.iqaScore}
                              <span className="text-sm font-medium text-purple-900">/100</span>
                            </p>
                            <Badge
                              variant={
                                indicators.iqaScore >= 70
                                  ? "excellent"
                                  : indicators.iqaScore >= 50
                                    ? "attention"
                                    : "critical"
                              }
                            >
                              {indicators.iqaLabel}
                            </Badge>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-purple-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${Math.min(100, indicators.iqaScore)}%` }}
                            />
                          </div>
                          <p className="text-xs text-purple-900">
                            Composto: pH (40%) · Turbidez (40%) · Temp. (20%)
                          </p>
                        </div>

                        <div className="rounded-xl border border-purple-600 bg-white p-3.5 space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                            Anomalias no Escopo
                          </p>
                          <p
                            className={`text-2xl font-bold tabular-nums ${
                              indicators.criticalCount > 0
                                ? "text-red-600"
                                : indicators.attentionCount > 0
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                            }`}
                          >
                            {indicators.criticalCount + indicators.attentionCount}{" "}
                            <span className="text-xs font-medium text-purple-900">
                              ({formatDecimalBR(indicators.anomalyPct, 1)}%)
                            </span>
                          </p>
                          <p className="text-xs text-purple-900 tabular-nums">
                            {indicators.criticalCount} crítica(s) · {indicators.attentionCount} atenção
                          </p>
                          <p className="text-[11px] text-purple-900 tabular-nums">
                            Maior sequência crítica: <strong>{indicators.maxConsecutiveCritical}</strong>
                          </p>
                        </div>

                        <div className="rounded-xl border border-purple-600 bg-white p-3.5 space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                            Reservatório & Tendência
                          </p>
                          <p className="text-2xl font-bold tabular-nums text-blue-900">
                            {indicators.avgReservoirPct}%
                          </p>
                          <div className="h-1.5 w-full rounded-full bg-purple-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-orange-500"
                              style={{ width: `${Math.min(100, indicators.avgReservoirPct)}%` }}
                            />
                          </div>
                          <p className="text-xs text-purple-900">
                            Turbidez: <strong className="text-blue-900">{indicators.turbidityTrend}</strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                        <h3 className="font-serif text-lg font-bold text-blue-900">
                          Resumo Estatístico das Medições
                        </h3>
                        <span className="text-xs text-purple-900 tabular-nums">
                          Base de cálculo:{" "}
                          <strong className="text-blue-900">
                            {activeReadings.length} medição(ões)
                          </strong>
                          {validSelectedSet.size > 0
                            ? " (seleção manual)"
                            : hasActiveTableFilters
                              ? " (filtro ativo)"
                              : " (período completo)"}
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-purple-600">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-blue-500 text-white text-xs uppercase">
                            <tr>
                              <th className="px-4 py-2.5">Parâmetro</th>
                              <th className="px-4 py-2.5 text-right">Média</th>
                              <th className="px-4 py-2.5 text-right">Mínimo</th>
                              <th className="px-4 py-2.5 text-right">Pico (Máx.)</th>
                              <th className="px-4 py-2.5 text-right">Desvio Padrão</th>
                              <th className="px-4 py-2.5">Limite Sanitário</th>
                              <th className="px-4 py-2.5 text-right">Situação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-500 bg-white">
                            <tr>
                              <td className="px-4 py-2.5 font-semibold text-blue-900">pH</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.ph.mean, 2)}
                              </td>
                              <td
                                className={`px-4 py-2.5 text-right tabular-nums ${
                                  stats.ph.min < 6.0 ? "font-bold text-red-600" : ""
                                }`}
                              >
                                {formatDecimalBR(stats.ph.min, 2)}
                              </td>
                              <td
                                className={`px-4 py-2.5 text-right tabular-nums ${
                                  stats.ph.max > 9.5 ? "font-bold text-red-600" : ""
                                }`}
                              >
                                {formatDecimalBR(stats.ph.max, 2)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.ph.stdDev, 2)}
                              </td>
                              <td className="px-4 py-2.5 text-purple-900">
                                6,0 a 9,5
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Badge variant={statusBadgeVariant(paramSummaryStatus.ph)}>
                                  {paramSummaryStatus.ph}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="bg-purple-100/60">
                              <td className="px-4 py-2.5 font-semibold text-blue-900">
                                Turbidez (UNT)
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.turbidity.mean, 2)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.turbidity.min, 2)}
                              </td>
                              <td
                                className={`px-4 py-2.5 text-right tabular-nums font-bold ${
                                  stats.turbidity.max >= 5
                                    ? "text-red-600"
                                    : stats.turbidity.max >= 4
                                      ? "text-amber-700"
                                      : ""
                                }`}
                              >
                                {formatDecimalBR(stats.turbidity.max, 2)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.turbidity.stdDev, 2)}
                              </td>
                              <td className="px-4 py-2.5 text-purple-900">
                                &lt; 5,0 UNT
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Badge variant={statusBadgeVariant(paramSummaryStatus.turbidity)}>
                                  {paramSummaryStatus.turbidity}
                                </Badge>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2.5 font-semibold text-blue-900">
                                Temperatura (°C)
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.temperature.mean, 1)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.temperature.min, 1)}
                              </td>
                              <td
                                className={`px-4 py-2.5 text-right tabular-nums font-bold ${
                                  stats.temperature.max >= 25 ? "text-red-600" : ""
                                }`}
                              >
                                {formatDecimalBR(stats.temperature.max, 1)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {formatDecimalBR(stats.temperature.stdDev, 2)}
                              </td>
                              <td className="px-4 py-2.5 text-purple-900">
                                &lt; 25,0 °C
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Badge variant={statusBadgeVariant(paramSummaryStatus.temperature)}>
                                  {paramSummaryStatus.temperature}
                                </Badge>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Trend Chart (Recharts) + Georeferenced Map (Leaflet) */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div>
                        <h3 className="font-serif text-lg font-bold text-blue-900 mb-3">
                          Gráfico de Tendência (Turbidez e pH)
                        </h3>
                        <div className="h-[260px] w-full rounded-lg border border-purple-600 bg-purple-100/40 p-3">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#d5dbe4"
                              />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: "#001325" }}
                              />
                              <YAxis
                                yAxisId="turb"
                                tick={{ fontSize: 11, fill: "#dc2626" }}
                                label={{
                                  value: "UNT",
                                  angle: -90,
                                  position: "insideLeft",
                                  fill: "#dc2626",
                                  fontSize: 10,
                                }}
                              />
                              <YAxis
                                yAxisId="ph"
                                orientation="right"
                                domain={[5, 10]}
                                tick={{ fontSize: 11, fill: "#002d58" }}
                                label={{
                                  value: "pH",
                                  angle: 90,
                                  position: "insideRight",
                                  fill: "#002d58",
                                  fontSize: 10,
                                }}
                              />
                              <Tooltip />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <ReferenceLine
                                yAxisId="turb"
                                y={5}
                                stroke="#dc2626"
                                strokeDasharray="4 4"
                                label={{
                                  value: "Limite Turbidez (5 UNT)",
                                  position: "insideTopRight",
                                  fill: "#dc2626",
                                  fontSize: 10,
                                }}
                              />
                              <Line
                                yAxisId="turb"
                                type="monotone"
                                dataKey="turbidez"
                                name="Turbidez (UNT)"
                                stroke="#dc2626"
                                strokeWidth={2.5}
                                dot={{ r: 3.5 }}
                                isAnimationActive={false}
                              />
                              <Line
                                yAxisId="ph"
                                type="monotone"
                                dataKey="ph"
                                name="pH"
                                stroke="#002d58"
                                strokeWidth={2.5}
                                dot={{ r: 3.5 }}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-serif text-lg font-bold text-blue-900 mb-3">
                          Localização Georreferenciada do Poço
                        </h3>
                        <WellsMap
                          wells={[selectedWell]}
                          selectedWellId={selectedWell.id}
                          singleFocus
                          heightClassName="h-[260px]"
                        />
                      </div>
                    </div>

                    {/* Period Anomalies & Maintenances */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-purple-600 bg-purple-100/60 p-4">
                        <h3 className="font-serif text-base font-bold text-blue-900 mb-2">
                          Alertas / Anomalias no Escopo ({anomalies.length})
                        </h3>
                        {anomalies.length === 0 ? (
                          <p className="text-xs text-purple-900">
                            Nenhuma anomalia sanitária detectada nas medições
                            selecionadas.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 text-xs">
                            {anomalies.map((a) => {
                              const s = classifyWaterStatus(a);
                              return (
                                <li
                                  key={a.id}
                                  className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-1.5 border border-purple-500"
                                >
                                  <span>
                                    <strong>{formatDateBR(a.timestamp)}</strong> —
                                    Turbidez {formatDecimalBR(a.turbidity)} UNT · pH{" "}
                                    {formatDecimalBR(a.ph)}
                                  </span>
                                  <Badge
                                    variant={
                                      s === "Crítico" ? "critical" : "attention"
                                    }
                                  >
                                    {s}
                                  </Badge>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-lg border border-purple-600 bg-purple-100/60 p-4">
                        <h3 className="font-serif text-base font-bold text-blue-900 mb-2">
                          Manutenções no Período ({periodMaintenances.length})
                        </h3>
                        {periodMaintenances.length === 0 ? (
                          <p className="text-xs text-purple-900">
                            Nenhuma manutenção registrada para este poço no período
                            filtrado.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 text-xs">
                            {periodMaintenances.map((m) => (
                              <li
                                key={m.id}
                                className="rounded bg-white px-2.5 py-1.5 border border-purple-500"
                              >
                                <strong>
                                  {new Date(m.createdAt).toLocaleDateString(
                                    "pt-BR"
                                  )}
                                </strong>{" "}
                                — {m.type} ({m.inspectorName})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Traceable Emission History */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-blue-500" />
                Histórico Rastreável de Boletins Emitidos ({bulletins.length})
              </CardTitle>
              <CardDescription>
                Registro auditável com protocolo, emissor, período e hash SHA-256.
              </CardDescription>
            </div>
            {bulletins.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-800" />
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Filtrar protocolo, poço ou emissor..."
                  aria-label="Filtrar histórico de boletins"
                  className="h-9 pl-8 text-xs"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {bulletins.length === 0 ? (
            <div className="rounded-xl border border-dashed border-purple-600 bg-purple-100/50 p-6 text-center text-xs text-purple-900">
              Nenhum boletim emitido ainda. Gere o primeiro relatório PDF acima
              para registrá-lo com hash SHA-256 no Supabase.
            </div>
          ) : filteredBulletins.length === 0 ? (
            <div className="rounded-xl border border-purple-600 bg-purple-50 p-4 text-center text-xs text-purple-900">
              Nenhum boletim encontrado para &ldquo;{historySearch}&rdquo;.
            </div>
          ) : (
            filteredBulletins.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-purple-600 bg-purple-100/70 p-4 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{b.protocolCode}</Badge>
                    <span className="font-serif text-base font-bold text-blue-900">
                      {b.wellName}
                    </span>
                  </div>
                  <span className="text-purple-900 tabular-nums">
                    Emitido em {new Date(b.generatedAt).toLocaleString("pt-BR")}{" "}
                    por{" "}
                    <strong>
                      {b.issuerName} ({b.issuerId})
                    </strong>
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-purple-900 tabular-nums">
                  <span>
                    <strong className="text-blue-900">Período:</strong>{" "}
                    {formatDateBR(b.periodStart)} a {formatDateBR(b.periodEnd)}
                  </span>
                  <span>
                    <strong className="text-blue-900">Leituras:</strong>{" "}
                    {b.readingsCount} ·{" "}
                    <strong className="text-blue-900">Alertas críticos:</strong>{" "}
                    {b.criticalAlertsCount}
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-white border border-purple-500 px-3 py-1.5 font-mono text-[11px] text-purple-900 overflow-x-auto">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="font-sans font-semibold text-blue-900 shrink-0">
                    SHA-256:
                  </span>
                  <span>{b.integrityHash}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
