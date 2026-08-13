import { RotateCcw, Search, SlidersHorizontal, TrainFront, X } from "lucide-react";

export type Filters = {
  query: string;
  stationQuery: string;
  maxWalkMinutes: "all" | 5 | 10 | 15;
  genre: string;
  area: "all" | "japan" | "overseas";
  business: "all" | "open" | "closed";
  awardsOnly: boolean;
  sort: "recommended" | "visits" | "views" | "station";
};

type FilterBarProps = {
  filters: Filters;
  genres: string[];
  resultCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (filters: Filters) => void;
  onReset: () => void;
};

export function FilterBar({
  filters,
  genres,
  resultCount,
  open,
  onOpenChange,
  onChange,
  onReset,
}: FilterBarProps) {
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section className={`filters ${open ? "filters--open" : ""}`} aria-label="店舗検索と絞り込み">
      <div className="searchbox">
        <Search size={18} aria-hidden="true" />
        <input
          value={filters.query}
          onChange={(event) => update("query", event.target.value)}
          placeholder="店名・住所・エリアで検索"
          aria-label="店名・住所・エリアで検索"
        />
        {filters.query && (
          <button className="icon-button icon-button--small" onClick={() => update("query", "")} aria-label="検索語を消去">
            <X size={15} />
          </button>
        )}
      </div>

      <button className="filter-toggle" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        <SlidersHorizontal size={17} />
        絞り込み
        <span>{resultCount}</span>
      </button>

      <div className="filters__panel">
        <div className="filters__panel-head">
          <div>
            <span className="eyebrow">FILTER</span>
            <h2>今日の一杯を絞る</h2>
          </div>
          <button className="icon-button filters__close" onClick={() => onOpenChange(false)} aria-label="絞り込みを閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="filter-group station-filter">
          <span className="filter-label">駅から探す <small>駅座標からの概算</small></span>
          <div className="searchbox station-searchbox">
            <TrainFront size={17} aria-hidden="true" />
            <input
              value={filters.stationQuery}
              onChange={(event) => update("stationQuery", event.target.value)}
              placeholder="駅名・路線名を入力"
              aria-label="駅名・路線名で検索"
            />
            {filters.stationQuery && (
              <button className="icon-button icon-button--small" onClick={() => update("stationQuery", "")} aria-label="駅名を消去">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="segmented segmented--four station-minutes">
            {([['all', '指定なし'], [5, '5分'], [10, '10分'], [15, '15分']] as const).map(([value, label]) => (
              <button key={value} className={filters.maxWalkMinutes === value ? "is-active" : ""} onClick={() => update("maxWalkMinutes", value)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">エリア</span>
          <div className="segmented segmented--three">
            {([['all', 'すべて'], ['japan', '国内'], ['overseas', '海外']] as const).map(([value, label]) => (
              <button key={value} className={filters.area === value ? "is-active" : ""} onClick={() => update("area", value)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">営業状況</span>
          <div className="segmented segmented--three">
            {([['all', 'すべて'], ['open', '閉店情報を除く'], ['closed', '閉店のみ']] as const).map(([value, label]) => (
              <button key={value} className={filters.business === value ? "is-active" : ""} onClick={() => update("business", value)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">味・ジャンル</span>
          <div className="chips">
            <button className={filters.genre === "all" ? "is-active" : ""} onClick={() => update("genre", "all")}>すべて</button>
            {genres.map((genre) => (
              <button key={genre} className={filters.genre === genre ? "is-active" : ""} onClick={() => update("genre", genre)}>{genre}</button>
            ))}
          </div>
        </div>

        <label className="check-row">
          <input type="checkbox" checked={filters.awardsOnly} onChange={(event) => update("awardsOnly", event.target.checked)} />
          <span className="custom-check" aria-hidden="true" />
          ラーメン大賞だけを見る
        </label>

        <button className="reset-button" onClick={onReset}>
          <RotateCcw size={15} />条件をリセット
        </button>
      </div>
    </section>
  );
}
