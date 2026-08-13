import { useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Clock3, Search, SlidersHorizontal, Sparkles, Soup } from "lucide-react";
import { homeRecipes } from "../data/homeRecipes";

const normalize = (value: string) => value.trim().toLocaleLowerCase("ja");

export function HomeMode() {
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const makers = useMemo(() => [...new Set(homeRecipes.map((recipe) => recipe.maker))], []);

  const recipes = useMemo(() => {
    const keyword = normalize(query);
    return homeRecipes.filter((recipe) => {
      if (maker !== "all" && recipe.maker !== maker) return false;
      if (!keyword) return true;
      return normalize(`${recipe.productName} ${recipe.maker} ${recipe.title} ${recipe.description} ${recipe.tags.join(" ")} ${recipe.ingredients.join(" ")}`).includes(keyword);
    });
  }, [maker, query]);

  const clearFilters = () => {
    setQuery("");
    setMaker("all");
  };

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <main className="home-mode">
      <section className="home-hero">
        <div className="home-hero__copy">
          <span className="home-hero__eyebrow"><Sparkles size={13} /> SUSURU AT HOME</span>
          <h1>家の一杯を、<br /><em>もっとすすろう。</em></h1>
          <p>カップ麺のレビューと、いつもの一杯がちょっと特別になるアレンジレシピ。</p>
        </div>
        <div className="home-hero__bowl" aria-hidden="true">
          <span className="steam steam--one" />
          <span className="steam steam--two" />
          <Soup size={74} strokeWidth={1.15} />
          <b>家</b>
        </div>
        <div className="home-hero__note" aria-hidden="true">ひと手間で<br />ずるずる！</div>
      </section>

      <section className="home-catalog" aria-label="おうちラーメンの一覧">
        <div className="home-toolbar">
          <label className="home-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">キーワード</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="商品名・材料・アレンジを検索"
              autoComplete="off"
            />
            <kbd>/</kbd>
          </label>
          <label className="maker-select">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>製造販売元</span>
            <select value={maker} onChange={(event) => setMaker(event.target.value)}>
              <option value="all">すべて</option>
              {makers.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div className="home-result-head">
          <div><strong>{String(recipes.length).padStart(2, "0")}</strong><span>RECIPES &amp; REVIEWS</span></div>
          <p>評価・ランキングなし。気になる一杯を自由にどうぞ。</p>
        </div>

        {recipes.length > 0 ? (
          <div className="recipe-grid" aria-live="polite">
            {recipes.map((recipe, index) => (
              <article className={`recipe-card recipe-card--${recipe.accent}`} key={recipe.id}>
                <div className="recipe-card__number">{String(index + 1).padStart(2, "0")}</div>
                <div className="recipe-card__visual" aria-hidden="true">
                  <span>{recipe.maker}</span>
                  <Soup size={51} strokeWidth={1.15} />
                  <i>{recipe.category === "アレンジ" ? "足" : "味"}</i>
                </div>
                <div className="recipe-card__content">
                  <div className="recipe-card__meta">
                    <span>{recipe.category}</span>
                    <span><Clock3 size={12} /> 約{recipe.time}分</span>
                  </div>
                  <p className="recipe-card__product">{recipe.productName}</p>
                  <h2>{recipe.title}</h2>
                  <p className="recipe-card__description">{recipe.description}</p>
                  <div className="recipe-card__tags">
                    {recipe.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                  </div>
                  <div className="recipe-card__recipe">
                    <div>
                      <h3>PLUS ONE</h3>
                      <ul>{recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                    <div>
                      <h3>HOW TO</h3>
                      <ol>{recipe.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="home-empty" aria-live="polite">
            <ChefHat size={42} strokeWidth={1.2} />
            <h2>その組み合わせは仕込み中です</h2>
            <p>キーワードか製造販売元を変えて探してみてください。</p>
            <button onClick={clearFilters}>絞り込みをクリア</button>
          </div>
        )}
      </section>
    </main>
  );
}
