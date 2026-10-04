import {
  useEffect,
  useMemo,
  useState
} from 'react';

type UploadLike = {
  id?: string;
  name?: string;
  path?: string;
  status?: string;
  progress?: number;
  uploaded_bytes?: number;
  total_bytes?: number;
  speed?: number;
};

type LiveStatus = {
  ok?: boolean;
  percentage?: number;
  uploaded_count?: number;
  active_count?: number;
  speed?: number;
  active?: UploadLike[];
};

interface UploadLiveCardProps {
  appUploads?: UploadLike[];
}

const STATUS_URL =
  'http://127.0.0.1:8787/status';

const THUMB_URL =
  'http://127.0.0.1:8788/thumb?path=';

function clamp(value: unknown) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) return 0;

  return Math.max(
    0,
    Math.min(100, n)
  );
}

function filename(item: UploadLike) {
  return (
    item.name ||
    item.path?.split('/').pop() ||
    'Archivo'
  );
}

function iconFor(name: string) {
  const ext =
    name.split('.').pop()?.toLowerCase() || '';

  if (
    ['jpg','jpeg','png','webp','gif','avif']
      .includes(ext)
  ) return '🖼️';

  if (
    ['mp4','mkv','avi','mov','webm','m4v']
      .includes(ext)
  ) return '🎬';

  if (ext === 'pdf') return '📕';

  if (
    ['cbz','cbr','zip','rar'].includes(ext)
  ) return '📚';

  return '📄';
}

function Preview({
  item
}: {
  item: UploadLike
}) {
  const [failed, setFailed] =
    useState(false);

  const name = filename(item);

  const src = useMemo(() => {
    if (!item.path) return '';

    return (
      THUMB_URL +
      encodeURIComponent(item.path)
    );
  }, [item.path]);

  if (!src || failed) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 14,
          background:
            'linear-gradient(145deg,#20242c,#12151b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 34
        }}
      >
        {iconFor(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="eager"
      onError={() => setFailed(true)}
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        objectFit: 'cover',
        borderRadius: 14,
        background: '#17191f',
        display: 'block'
      }}
    />
  );
}

export function UploadLiveCard({
  appUploads = []
}: UploadLiveCardProps) {
  const [live, setLive] =
    useState<LiveStatus | null>(null);

  const [connected, setConnected] =
    useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await fetch(
          `${STATUS_URL}?t=${Date.now()}`,
          {
            cache: 'no-store'
          }
        );

        if (!response.ok) {
          throw new Error(
            String(response.status)
          );
        }

        const json =
          await response.json();

        if (alive) {
          setLive(json);
          setConnected(true);
        }
      } catch {
        if (alive) {
          setConnected(false);
        }
      }
    };

    load();

    const timer =
      window.setInterval(load, 1000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const external =
    Array.isArray(live?.active)
      ? live!.active!
      : [];

  const active =
    external.length
      ? external
      : appUploads.filter(item =>
          [
            'pending',
            'uploading',
            'downloading',
            'encrypting',
            'verifying'
          ].includes(
            String(item.status || '')
          )
        );

  // EXACTAMENTE cuatro tarjetas visibles.
  const visible =
    active.slice(0, 4);

  const overall =
    clamp(live?.percentage);

  const activeCount =
    Number(
      live?.active_count ??
      active.length
    );

  const uploadedCount =
    Number(
      live?.uploaded_count ?? 0
    );

  return (
    <section
      style={{
        margin: '12px 12px 16px',
        padding: 16,
        borderRadius: 20,
        background:
          'rgba(24,27,34,.96)',
        border:
          '1px solid rgba(255,255,255,.08)',
        boxShadow:
          '0 12px 28px rgba(0,0,0,.22)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#fff'
            }}
          >
            Subiendo ahora
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: '#9da5b3'
            }}
          >
            {activeCount > 0
              ? `${activeCount} archivos activos`
              : 'Sin subidas activas'}
          </div>
        </div>

        <div
          style={{
            minWidth: 55,
            textAlign: 'right',
            fontSize: 18,
            fontWeight: 800,
            color: '#4fa9ff'
          }}
        >
          {Math.round(overall)}%
        </div>
      </div>

      {/* BARRA GENERAL REAL */}
      <div
        style={{
          width: '100%',
          height: 9,
          overflow: 'hidden',
          borderRadius: 999,
          background: '#323741',
          marginBottom: 14
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${overall}%`,
            borderRadius: 999,
            background:
              'linear-gradient(90deg,#2997ff,#65bdff)',
            transition:
              'width .5s ease'
          }}
        />
      </div>

      {/* 4 IMÁGENES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(2,minmax(0,1fr))',
          gap: 8
        }}
      >
        {[0,1,2,3].map(index => {
          const item =
            visible[index];

          if (!item) {
            return (
              <div
                key={`empty-${index}`}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 14,
                  background:
                    'rgba(255,255,255,.035)',
                  border:
                    '1px dashed rgba(255,255,255,.08)'
                }}
              />
            );
          }

          const progress =
            clamp(item.progress);

          const name =
            filename(item);

          return (
            <div
              key={
                item.id ||
                item.path ||
                `${name}-${index}`
              }
              style={{
                minWidth: 0
              }}
            >
              <div
                style={{
                  position: 'relative'
                }}
              >
                <Preview item={item} />

                <div
                  style={{
                    position: 'absolute',
                    right: 5,
                    bottom: 5,
                    padding:
                      '3px 6px',
                    borderRadius: 999,
                    background:
                      'rgba(0,0,0,.72)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                >
                  {Math.round(progress)}%
                </div>
              </div>

              {/* BARRA DE CADA ARCHIVO */}
              <div
                style={{
                  marginTop: 6,
                  height: 4,
                  overflow: 'hidden',
                  borderRadius: 999,
                  background: '#323741'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width:
                      `${progress}%`,
                    background:
                      '#4fa9ff',
                    transition:
                      'width .4s ease'
                  }}
                />
              </div>

              <div
                title={name}
                style={{
                  marginTop: 5,
                  color: '#dce1e8',
                  fontSize: 10,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow:
                    'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {name}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#9098a5'
        }}
      >
        <span>
          {connected
            ? '● Telegram conectado'
            : '○ Esperando servidor'}
        </span>

        <span>
          {uploadedCount.toLocaleString()}
          {' '}subidos
        </span>
      </div>
    </section>
  );
}
