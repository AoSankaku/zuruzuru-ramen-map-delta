export type HomeRecipe = {
  id: string;
  productName: string;
  maker: string;
  category: "アレンジ" | "レビュー";
  title: string;
  description: string;
  time: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
  accent: "red" | "gold" | "green" | "blue" | "orange" | "black";
};

export const homeRecipes: HomeRecipe[] = [
  {
    id: "seafood-milk",
    productName: "カップヌードル シーフードヌードル",
    maker: "日清食品",
    category: "アレンジ",
    title: "濃厚ミルクシーフード",
    description: "お湯の半量を温めた牛乳に替えて、まろやかで濃厚な一杯に。黒こしょうが味を引き締めます。",
    time: 5,
    ingredients: ["牛乳 150ml", "熱湯 150ml", "黒こしょう 少々"],
    steps: ["牛乳を沸騰直前まで温める", "熱湯と牛乳を注いで3分待つ", "よく混ぜて黒こしょうを振る"],
    tags: ["まろやか", "ちょい足し"],
    accent: "blue",
  },
  {
    id: "akakara-cheese",
    productName: "カップヌードル チリトマトヌードル",
    maker: "日清食品",
    category: "アレンジ",
    title: "焼きチーズ・チリトマト",
    description: "とろけるチーズと卵黄で辛みを包み込む、背徳感たっぷりの濃厚アレンジです。",
    time: 6,
    ingredients: ["とろけるチーズ 1枚", "卵黄 1個", "乾燥パセリ 適量"],
    steps: ["通常より少なめのお湯を注ぐ", "3分後にチーズをのせる", "卵黄とパセリを添えて混ぜる"],
    tags: ["濃厚", "チーズ"],
    accent: "red",
  },
  {
    id: "donbei-carbonara",
    productName: "日清のどん兵衛 きつねうどん",
    maker: "日清食品",
    category: "アレンジ",
    title: "だし香る和風カルボナーラ",
    description: "湯切りしたうどんに卵と粉チーズを絡めます。だしの甘みが意外なほど好相性。",
    time: 7,
    ingredients: ["卵 1個", "粉チーズ 大さじ1", "ベーコン 20g"],
    steps: ["麺を通常どおり戻して湯切りする", "卵・粉チーズ・粉末スープ半量を混ぜる", "麺と炒めたベーコンを素早く和える"],
    tags: ["汁なし", "洋風"],
    accent: "gold",
  },
  {
    id: "maruchan-yakisoba",
    productName: "ごつ盛り ソース焼そば",
    maker: "東洋水産",
    category: "アレンジ",
    title: "目玉焼きナポリタン風",
    description: "ソースを少し控え、ケチャップの甘酸っぱさと半熟卵で喫茶店らしい味に仕上げます。",
    time: 8,
    ingredients: ["卵 1個", "ケチャップ 大さじ1", "粉チーズ 適量"],
    steps: ["麺を戻してしっかり湯切りする", "ソース半量とケチャップを混ぜる", "目玉焼きと粉チーズをのせる"],
    tags: ["ボリューム", "喫茶店風"],
    accent: "orange",
  },
  {
    id: "sapporo-shio-lemon",
    productName: "サッポロ一番 塩らーめんどんぶり",
    maker: "サンヨー食品",
    category: "アレンジ",
    title: "ねぎ塩レモンラーメン",
    description: "長ねぎとレモンでさっぱり。ごま油を最後にひと回しすると香りに奥行きが出ます。",
    time: 6,
    ingredients: ["長ねぎ 5cm", "レモン 1切れ", "ごま油 小さじ1/2"],
    steps: ["長ねぎを細く切る", "通常どおり麺を作る", "ねぎとレモンをのせ、ごま油を回しかける"],
    tags: ["さっぱり", "香味"],
    accent: "green",
  },
  {
    id: "ippei-mayo",
    productName: "明星 一平ちゃん夜店の焼そば",
    maker: "明星食品",
    category: "レビュー",
    title: "からしマヨの黄金バランス",
    description: "香ばしいソースとからしマヨの一体感を楽しむ定番。まずはそのまま、後半に紅しょうがで味変を。",
    time: 4,
    ingredients: ["紅しょうが 適量", "青のり 適量"],
    steps: ["表示どおりに麺を戻して湯切りする", "ソースを麺全体にしっかり絡める", "からしマヨと薬味を仕上げにのせる"],
    tags: ["定番", "ソース"],
    accent: "black",
  },
  {
    id: "wakame-egg",
    productName: "わかめラーメン ごま・しょうゆ",
    maker: "エースコック",
    category: "アレンジ",
    title: "ふわふわ卵のわかめスープ麺",
    description: "溶き卵を加えてスープの満足感をアップ。ラー油を少し垂らせば夜食にもぴったりです。",
    time: 6,
    ingredients: ["卵 1個", "ラー油 少々", "白ごま 適量"],
    steps: ["卵をよく溶いておく", "熱湯を注いで2分待つ", "卵を細く流し入れ、ふたをして1分待つ"],
    tags: ["夜食", "たまご"],
    accent: "green",
  },
  {
    id: "charumera-butter",
    productName: "明星 チャルメラカップ しょうゆ",
    maker: "明星食品",
    category: "アレンジ",
    title: "焦がしバターコーン",
    description: "バターで炒めたコーンをのせるだけ。しょうゆスープに香ばしい甘みが溶け込みます。",
    time: 7,
    ingredients: ["コーン 30g", "バター 5g", "黒こしょう 少々"],
    steps: ["フライパンでバターを溶かす", "コーンに焼き色がつくまで炒める", "完成した麺にのせ、黒こしょうを振る"],
    tags: ["香ばしい", "ちょい足し"],
    accent: "gold",
  },
];
