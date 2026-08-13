import { useEffect, useRef, useState, type FormEvent } from "react";
import { Crosshair, LocateFixed, MapPin, Search, Trash2, X } from "lucide-react";
import { searchLocation, type UserLocation } from "../location";

type LocationControlProps = {
  location: UserLocation | null;
  open: boolean;
  picking: boolean;
  onOpenChange: (open: boolean) => void;
  onPickingChange: (picking: boolean) => void;
  onLocationChange: (location: UserLocation | null) => void;
};

type LocationStatus = "idle" | "loading" | "error";

export function LocationControl({
  location,
  open,
  picking,
  onOpenChange,
  onPickingChange,
  onLocationChange,
}: LocationControlProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const setCurrentLocation = (nextLocation: UserLocation) => {
    requestRef.current = null;
    setStatus("idle");
    setMessage("");
    onPickingChange(false);
    onLocationChange(nextLocation);
  };

  const useDeviceLocation = () => {
    requestRef.current?.abort();
    requestRef.current = null;

    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("このブラウザでは端末の位置情報を利用できません。手入力または地図上で指定してください。");
      return;
    }

    setStatus("loading");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: "端末の現在地",
        });
      },
      () => {
        setStatus("error");
        setMessage("端末の位置情報を取得できませんでした。手入力または地図上で指定できます。");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  };

  const submitLocation = async (event: FormEvent) => {
    event.preventDefault();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setMessage("");

    try {
      setCurrentLocation(await searchLocation(query, controller.signal));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "場所を検索できませんでした。");
    }
  };

  return (
    <div className={`location-control${open ? " is-open" : ""}`}>
      <button
        className={`locate-button${location ? " is-done" : ""}${status === "loading" ? " is-loading" : ""}`}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="location-panel"
      >
        <LocateFixed size={17} />
        {location ? "現在地を設定済み" : "現在地を設定"}
      </button>

      <section id="location-panel" className="location-panel" hidden={!open} aria-label="現在地の設定">
        <div className="location-panel__head">
          <div>
            <span className="eyebrow">YOUR LOCATION</span>
            <h2>現在地を設定</h2>
          </div>
          <button className="icon-button icon-button--small" onClick={() => onOpenChange(false)} aria-label="現在地の設定を閉じる">
            <X size={17} />
          </button>
        </div>

        <button className="location-action" onClick={useDeviceLocation} disabled={status === "loading"}>
          <Crosshair size={18} />
          <span><b>端末の位置情報を使う</b><small>ブラウザの許可が必要です</small></span>
        </button>

        <form className="location-form" onSubmit={submitLocation}>
          <label htmlFor="location-query">住所・駅名、または緯度,経度</label>
          <div className="searchbox">
            <Search size={17} aria-hidden="true" />
            <input
              ref={inputRef}
              id="location-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例: 東京駅 / 35.6812, 139.7671"
              autoComplete="off"
            />
            <button className="location-search-button" type="submit" disabled={status === "loading"}>検索</button>
          </div>
        </form>

        <button
          className={`location-action${picking ? " is-active" : ""}`}
          onClick={() => {
            requestRef.current?.abort();
            requestRef.current = null;
            setStatus("idle");
            setMessage("");
            onPickingChange(!picking);
          }}
        >
          <MapPin size={18} />
          <span><b>{picking ? "地図上の場所をクリックしてください" : "地図上で指定する"}</b><small>クリックした地点に現在地を置きます</small></span>
        </button>

        {message && <p className="location-message is-error" role="alert">{message}</p>}

        {location && (
          <div className="location-current">
            <MapPin size={16} />
            <span><b>{location.label}</b><small>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</small></span>
            <button
              className="icon-button icon-button--small"
              onClick={() => {
                onPickingChange(false);
                onLocationChange(null);
              }}
              aria-label="設定した現在地を解除"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}

        <p className="location-attribution">
          住所・駅名は外部サービスへ送信されます。検索: <a href="https://nominatim.org/" target="_blank" rel="noreferrer">Nominatim</a> / © OpenStreetMap contributors
        </p>
      </section>
    </div>
  );
}
