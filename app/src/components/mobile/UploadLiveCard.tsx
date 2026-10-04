import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  FolderOpen,
  UploadCloud,
} from 'lucide-react';

interface RemoteUpload {
  id: string;
  name: string;
  path?: string;
  status: string;
  progress: number;
  uploaded_bytes: number;
  total_bytes: number;
  speed: number;
}

interface StatusResponse {
  ok: boolean;
  percentage: number;
  uploaded_count: number;
  active_count: number;
  speed: number;
  uploaded_bytes: number;
  total_bytes: number;
  active: RemoteUpload[];
}

interface Props {
  appUploads?: any[];
}

function bytes(value: number): string {
  const n = Number(value || 0);

  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

const LIVE = new Set([
  'pending',
  'uploading',
  'downloading',
  'encrypting',
  'verifying',
  'paused',
  'waiting_for_network',
  'waiting_for_unlock',
]);

export function UploadLiveCard({ appUploads = [] }: Props) {
  const [remote, setRemote] = useState<StatusResponse | null>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let alive = true;

    const update = async () => {
      try {
        const response = await fetch(
          'http://127.0.0.1:8787/status',
          {
            cache: 'no-store',
            signal: AbortSignal.timeout(850),
          },
        );

        if (!response.ok) return;

        const data = await response.json();

        if (alive) {
          setRemote(data);
        }
      } catch {
        // Termux puede estar dormido o cerrado.
      }
    };

    void update();

    const timer = window.setInterval(
      () => void update(),
      1000,
    );

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const localItems: RemoteUpload[] = useMemo(
    () =>
      appUploads
        .filter((item) => LIVE.has(item.status))
        .map((item) => {
          const name =
            ('filename' in item && item.filename)
              ? item.filename
              : (
                  item.url
                  || item.path
                  || 'Archivo'
                ).split(/[\\/]/).pop() || 'Archivo';

          return {
            id: `app:${item.id}`,
            name,
            path: item.path || item.url || '',
            status: item.status,
            progress: Number(item.progress || 0),
            uploaded_bytes: Number(item.uploadedBytes || 0),
            total_bytes: Number(item.totalBytes || 0),
            speed: Number(item.speedBytesPerSec || 0),
          };
        }),
    [appUploads],
  );

  const items = useMemo(() => {
    const merged = [
      ...(remote?.active || []),
      ...localItems,
    ];

    const seen = new Set<string>();

    return merged.filter((item) => {
      const key = [
        item.name,
        item.total_bytes,
        Math.round(item.progress),
      ].join('|');

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }, [localItems, remote]);

  const percent = useMemo(() => {
    if (!items.length) {
      return remote?.uploaded_count ? 100 : 0;
    }

    const value =
      items.reduce(
        (sum, item) =>
          sum + (
            item.status === 'success'
              ? 100
              : Math.max(
                  0,
                  Math.min(
                    100,
                    Number(item.progress || 0),
                  ),
                )
          ),
        0,
      ) / items.length;

    return Math.round(value);
  }, [items, remote?.uploaded_count]);

  const speed = items.reduce(
    (sum, item) => sum + Number(item.speed || 0),
    0,
  );

  const uploadedBytes = items.reduce(
    (sum, item) =>
      sum + Number(item.uploaded_bytes || 0),
    0,
  );

  const totalBytes = items.reduce(
    (sum, item) =>
      sum + Number(item.total_bytes || 0),
    0,
  );

  return (
    <section className="space-y-3">

      {/* Tarjeta principal */}
      <div className="overflow-hidden rounded-3xl border border-telegram-primary/20 bg-gradient-to-br from-telegram-primary/15 via-telegram-hover/25 to-telegram-bg shadow-lg">

        <div className="p-4">

          <div className="flex items-start justify-between gap-4">

            <div className="flex min-w-0 items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-telegram-primary/15">
                <CloudUpload className="h-6 w-6 text-telegram-primary" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-telegram-text">
                    Telegram Drive
                  </h2>

                  {items.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      En vivo
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[10px] text-telegram-subtext">
                  {(remote?.uploaded_count || 0).toLocaleString('es-CL')} archivos subidos
                  {' · '}
                  {items.length} subiendo ahora
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black tabular-nums text-telegram-primary">
                {percent}%
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-telegram-subtext">
                subido
              </div>
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-telegram-border/25">

            <div
              className="h-full rounded-full bg-telegram-primary transition-[width] duration-500"
              style={{
                width: `${Math.max(
                  items.length ? 2 : 0,
                  percent,
                )}%`,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] text-telegram-subtext">

            <span>
              {totalBytes > 0
                ? `${bytes(uploadedBytes)} / ${bytes(totalBytes)}`
                : items.length
                  ? 'Calculando tamaño…'
                  : 'Todo al día'}
            </span>

            <span className="flex items-center gap-1 font-mono">
              <Activity className="h-3 w-3" />
              {speed > 0
                ? `${bytes(speed)}/s`
                : '0 B/s'}
            </span>
          </div>
        </div>
      </div>

      {/* Carpeta virtual */}
      <button
        type="button"
        onClick={() => setOpened((value) => !value)}
        className="flex w-full items-center gap-3 rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-3.5 text-left transition-all active:scale-[0.99]"
      >
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-telegram-primary/10">

          <FolderOpen className="h-6 w-6 text-telegram-primary" />

          {items.length > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-telegram-primary px-1 text-[9px] font-black text-black">
              {items.length}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-telegram-text">
            Subiendo ahora
          </p>

          <p className="text-[10px] text-telegram-subtext">
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? 'archivo' : 'archivos'} en tiempo real`
              : 'Sin transferencias activas'}
          </p>
        </div>

        {opened
          ? <ChevronUp className="h-4 w-4 text-telegram-subtext" />
          : <ChevronDown className="h-4 w-4 text-telegram-subtext" />
        }
      </button>

      {/* Interior de la carpeta */}
      {opened && (
        <div className="overflow-hidden rounded-2xl border border-telegram-border/30 bg-telegram-hover/10">

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <UploadCloud className="mx-auto mb-2 h-7 w-7 text-telegram-subtext/40" />

              <p className="text-xs font-semibold text-telegram-text">
                No hay archivos subiendo
              </p>

              <p className="mt-1 text-[10px] text-telegram-subtext">
                Los próximos aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="border-b border-telegram-border/20 px-4 py-3 last:border-b-0"
              >
                <div className="flex items-start gap-3">

                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-telegram-primary/10">
                    <UploadCloud className="h-4 w-4 text-telegram-primary" />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="flex items-center justify-between gap-3">

                      <p className="truncate text-xs font-semibold text-telegram-text">
                        {item.name}
                      </p>

                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-telegram-primary">
                        {Math.round(item.progress || 0)}%
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[9px] text-telegram-subtext">

                      <span className="capitalize">
                        {String(item.status || 'uploading')
                          .replace(/_/g, ' ')}
                      </span>

                      <span className="font-mono">
                        {item.speed > 0
                          ? `${bytes(item.speed)}/s`
                          : ''}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-telegram-border/25">
                      <div
                        className="h-full rounded-full bg-telegram-primary transition-[width] duration-300"
                        style={{
                          width: `${Math.max(
                            2,
                            Math.min(
                              100,
                              Number(item.progress || 0),
                            ),
                          )}%`,
                        }}
                      />
                    </div>

                    {item.total_bytes > 0 && (
                      <p className="mt-1.5 text-[9px] tabular-nums text-telegram-subtext/70">
                        {bytes(item.uploaded_bytes)}
                        {' / '}
                        {bytes(item.total_bytes)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
