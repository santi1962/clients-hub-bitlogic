import { Download, Play, Pause } from "lucide-react";
import { useRef, useState } from "react";
import { useSecureUrl } from "@/hooks/useSecureUrl";

interface Props {
  url: string;
  type: "image" | "audio" | "file";
  name: string | null;
}

function AudioPlayer({ blobUrl, name }: { blobUrl: string; name: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const a = audioRef.current!;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 min-w-[200px]">
      <audio
        ref={audioRef}
        src={blobUrl}
        onTimeUpdate={(e) =>
          setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)
        }
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button onClick={toggle} className="shrink-0 text-white/80 hover:text-white">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className="h-1 rounded-full bg-white/20">
          <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-0.5 text-[10px] text-white/50">{name ?? "Audio"} · {fmt(duration)}</p>
      </div>
    </div>
  );
}

export function SecureAttachment({ url, type, name }: Props) {
  const blobUrl = useSecureUrl(url);

  if (!blobUrl) {
    return (
      <div className="text-xs text-muted-foreground italic">Cargando archivo…</div>
    );
  }

  if (type === "audio") {
    return <AudioPlayer blobUrl={blobUrl} name={name} />;
  }

  if (type === "image") {
    return (
      <img
        src={blobUrl}
        alt={name ?? "imagen"}
        className="max-w-[240px] rounded-lg"
      />
    );
  }

  return (
    <a
      href={blobUrl}
      download={name ?? "archivo"}
      className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 hover:bg-black/20"
    >
      <Download className="h-4 w-4 shrink-0" />
      <span className="truncate text-xs">{name ?? "Archivo"}</span>
    </a>
  );
}
