/**
 * All Hebrew UI text in one place. Plain strings and small template functions only — no
 * imports, so every layer (domain included) may depend on this module.
 */
export const he = {
  app: {
    title: 'בוחר דירות אלמוגים',
    brandName: 'אלמוגים',
    brandCity: 'חיפה',
    headerStats: (lottery: number, units: number, buildings: number, target: number) =>
      `הגרלה ${lottery} · ${units} דירות · ${buildings} בניינים · ${target} במחיר מטרה`,
    viewsLabel: 'תצוגות',
    tabs: { apartments: 'דירות', myList: 'הרשימה שלי', data: 'נתונים' },
    notice:
      'המחירים והשטחים לקוחים מקובץ המחירים של הקבלן. בקובץ אין מחיר לדירות השוק החופשי, וגם לא כיווני אוויר או מיקום הדירה בקומה, ולכן אינם מוצגים כנתון. ההדמיה התלת־ממדית סכמטית בלבד.',
    noticeClose: 'סגירת ההודעה',
    footer:
      'האתר הוא כלי עזר פרטי להמחשה בלבד, ללא אחריות. יש לוודא כל נתון מול המסמכים הרשמיים של הקבלן. מחיר למ״ר מחושב כמחיר הדירה חלקי שטח הדירה, ללא המרפסת או הגינה. "דירות דומות" הן דירות מאותה תוכנית (טיפוס תשריט), ואם יש פחות מארבע כאלה, דירות עם אותו מספר חדרים ואותו סוג. התמונה היא הדמיית הפרויקט.',
    notFound: 'העמוד לא נמצא.',
    backHome: 'חזרה לדירות',
  },

  common: {
    target: 'מחיר מטרה',
    free: 'שוק חופשי',
    ground: 'קרקע',
    floor: 'קומה',
    sqm: 'מ״ר',
    shekel: '₪',
    notPublished: 'לא פורסם',
    dash: '-',
    addToMyList: 'הוספה לרשימה שלי',
    removeFromMyList: 'הסרה מהרשימה שלי',
  },

  kind: { T: 'רגילה', G: 'דירת גן', P: 'פנטהאוז' },

  /** Compass points, index = round(deg / 45). */
  directions: ['צפון', 'צפון־מזרח', 'מזרח', 'דרום־מזרח', 'דרום', 'דרום־מערב', 'מערב', 'צפון־מערב'],

  seasons: { winter: 'חורף', equinox: 'אביב/סתיו', summer: 'קיץ' },

  rooms: {
    salon: 'סלון',
    master: 'חדר הורים',
    kit: 'מטבח',
    bath: 'רחצה',
    mamad3: 'ממ״ד / חדר',
    bed: 'חדר',
    wc: 'שירותים',
    mamad: 'ממ״ד',
    svc: 'חדר שירות',
    bath2: 'רחצה הורים',
  },

  map: {
    title: 'מפת הפרויקט',
    count: (hits: number, total: number) => `${hits} מתוך ${total} דירות תואמות`,
    hint: 'לחצו על בניין כדי לסנן אותו ולראות את כל הקומות',
    imageAlt: 'הדמיית הפרויקט עם מספרי הבניינים',
    pickerLabel: 'בחירת בניין',
    hotspot: (building: string, count: number) => `בניין ${building}, ${count} דירות תואמות`,
  },

  elevation: {
    title: (building: string) => `בניין ${building}`,
    summary: (plot: number, units: number, from: string, to: string, target: number) =>
      `מגרש ${plot} · ${units} דירות · קומות ${from} עד ${to} · ${target} במחיר מטרה`,
    legendUnmatched: 'לא תואם לסינון',
    legendTile: 'באריח: סוג הדירה ומספר חדרים',
    tileTitle: (unit: number, rooms: number, area: number, price: string | null) =>
      `דירה ${unit} · ${rooms} חדרים · ${area} מ״ר${price != null ? ' · ' + price : ''}`,
  },

  filters: {
    title: 'סינון',
    count: (n: number) => `${n} דירות תואמות`,
    budget: 'תקציב (באלפי ₪)',
    budgetMin: 'מינימום',
    budgetMax: 'מקסימום',
    budgetMinAria: 'תקציב מינימלי באלפי שקלים',
    budgetMaxAria: 'תקציב מקסימלי באלפי שקלים',
    rooms: 'חדרים',
    roomOptions: { 3: '3', 4: '4 – 4.5', 5: '5 – 5.5', 6: '6 +' },
    floor: 'קומה',
    floorMin: 'מקומה',
    floorMax: 'עד קומה',
    building: 'בניין',
    category: 'סוג',
    categoryAll: 'הכול',
    flags: 'מאפיינים',
    flagOptions: { garden: 'דירת גן', pent: 'פנטהאוז', top: 'קומה אחרונה בבניין' },
    storage: 'קומת המחסן',
    storageOptions: { ground: 'קרקע', minus1: 'מינוס 1', minus2: 'מינוס 2' },
    sort: 'מיון',
    sortOptions: {
      ppsqm: 'מחיר למ״ר: מהזול ליקר',
      delta: 'הכי משתלם מול דירות דומות',
      priceA: 'מחיר: מהזול ליקר',
      priceD: 'מחיר: מהיקר לזול',
      area: 'שטח: מהגדול לקטן',
      floor: 'קומה: מהגבוהה לנמוכה',
      id: 'בניין ומספר דירה',
    },
    reset: 'ניקוי סינון',
  },

  list: {
    title: 'דירות',
    empty: 'אין דירות שמתאימות לסינון. נסו להרחיב את התקציב או לנקות מסננים.',
    more: (rest: number) => `הצג עוד (${rest})`,
  },

  card: {
    open: (unit: number, building: string) => `פתיחת דירה ${unit} בבניין ${building}`,
    heading: (building: string, unit: number, floor: string) =>
      `בניין ${building} · דירה ${unit} · קומה ${floor}`,
    roomsArea: (rooms: number, area: string) => `${rooms} חדרים · ${area} מ״ר`,
    perSqm: (value: string) => `${value} ₪ למ״ר`,
    saleType: (sale: string) => `סוג ${sale}`,
    garden: (area: string) => `גינה ${area} מ״ר`,
    roofTerrace: (area: string) => `מרפסת גג ${area} מ״ר`,
    balcony: (area: string) => `מרפסת ${area} מ״ר`,
    storageGround: 'מחסן בקרקע',
    storageLevel: (level: string) => `מחסן במפלס ${level}`,
    vsPeers: (pct: string) => `${pct} מדירות דומות`,
    priceNotPublished: 'מחיר טרם פורסם',
  },

  sheet: {
    title: (building: string, unit: number, floorName: string) =>
      `בניין ${building} · דירה ${unit} · ${floorName}`,
    subtitle: (rooms: number, area: string, price: string, category: string) =>
      `${rooms} חדרים · ${area} מ״ר · ${price} · ${category}`,
    close: 'סגירה',
    tabsLabel: 'פרטי הדירה',
    tabs: { insights: 'תובנות', building: 'הבניין והקומה', schematic: 'הדמיה סכמטית' },
  },

  insightsTab: {
    kpiPrice: 'מחיר',
    kpiPerSqm: 'מחיר למ״ר',
    kpiPeerMean: 'ממוצע דירות דומות',
    kpiRank: 'דירוג מחיר למ״ר בקבוצה',
    rankOf: (rank: number, size: number) => `${rank} מתוך ${size}`,
    gaugeTitle: (label: string) => `המחיר למ״ר מול דירות ${label}`,
    gaugeMin: (v: string) => `${v} ₪ (הזולה)`,
    gaugeMean: (v: string) => `ממוצע ${v} ₪`,
    gaugeMax: (v: string) => `${v} ₪ (היקרה)`,
    whatToKnow: 'מה כדאי לדעת',
    details: 'פרטי הדירה',
    factPlan: 'תוכנית (תשריט)',
    factSale: 'סוג מכר',
    factKind: 'סוג',
    factArea: 'שטח דירה',
    factStorage: 'מחסן',
  },

  insights: {
    cheaperTitle: 'מחיר למ״ר נמוך מדירות דומות',
    pricierTitle: 'מחיר למ״ר גבוה מדירות דומות',
    averageTitle: 'מחיר למ״ר קרוב לממוצע',
    vsPeers: (pct: string, size: number, label: string) =>
      `${pct} מהממוצע של ${size} דירות ${label}.`,
    pricierNote: ' בדרך כלל הפער נובע מקומה גבוהה יותר.',
    lowestOfPlanTitle: 'הקומה הנמוכה והזולה בתוכנית הזו בבניין',
    lowestOfPlanText: (others: number, building: string) =>
      `יש עוד ${others} דירות מאותה תוכנית בבניין ${building}, כולן יקרות יותר.`,
    aboveLowestTitle: (diff: string, floor: string) => `${diff} יותר מהדירה הזהה בקומה ${floor}`,
    aboveLowestText: (floor: string, price: string, perFloor: string | null) =>
      `באותו בניין, אותה תוכנית בקומה ${floor} עולה ${price}. ${perFloor != null ? `זה ${perFloor} לכל קומה בממוצע.` : ''}`,
    freeTitle: 'מחיר שוק חופשי טרם פורסם',
    freeText:
      'בקובץ המחירים אין מחיר לדירות השוק החופשי. כשיפורסם, אפשר לטעון קובץ מעודכן בלשונית ״נתונים״.',
    storageTitle: (no: string, area: string, where: string) => `מחסן ${no}: ${area} מ״ר, ${where}`,
    storageText: (building: string, avg: string, small: boolean, ground: boolean) =>
      `ממוצע המחסנים בבניין ${building} הוא ${avg} מ״ר${small ? ', המחסן הזה קטן מהממוצע' : ''}.${ground ? ' מחסן בקרקע נגיש יותר מחניון תת־קרקעי.' : ''}`,
    storageWhereGround: (sub: string) => `בקרקע${sub ? ' (' + sub + ')' : ''}`,
    storageWhereLevel: (level: string) => `במפלס ${level}`,
    outdoorNames: { G: 'גינה', P: 'מרפסת גג', T: 'מרפסת' },
    outdoorTitle: (name: string, area: string) => `${name} ${area} מ״ר`,
    outdoorVsGroup: (avg: string, large: boolean) =>
      `ממוצע בקבוצה ${avg} מ״ר. ${large ? 'הדירה הזו עם שטח חיצוני גדול מהרגיל.' : ''}`,
    outdoorNoGroup: 'שטח המרפסת או הגינה כפי שמופיע בקובץ.',
    parkingTitle: (n: number) => `${n} חניות`,
    parkingText: 'מספר החניות לפי קובץ המחירים.',
    topTitle: 'קומה אחרונה בבניין',
    topText: 'אין דירות מעל. כדאי לברר בידוד ואיטום גג.',
    bottomGardenTitle: 'דירת גן בקומה הנמוכה בבניין',
    bottomTitle: 'קומה נמוכה בבניין',
    bottomText: 'פחות פרטיות מהכניסות והחצר, אך נגישות נוחה.',
    peerLabelPlan: (plan: string) => `מתוכנית ${plan}`,
    peerLabelRooms: (rooms: number, kind: string) => `בנות ${rooms} חדרים (${kind})`,
  },

  buildingTab: {
    onMap: (building: string) => `בניין ${building} במפה`,
    plot: 'מגרש בתב״ע',
    floors: 'קומות',
    floorsRange: (from: string, to: string) => `${from} עד ${to}`,
    units: 'דירות',
    target: 'במחיר מטרה',
    targetValue: (n: number, pct: number) => `${n} (${pct}%)`,
    avgArea: 'שטח ממוצע',
    priceRange: 'טווח מחירים',
    priceRangeValue: (min: string, max: string) => `${min}K עד ${max}K`,
    onFloor: (floor: string) => `דירות בקומה ${floor}`,
    samePlan: (plan: string) => `אותה תוכנית (${plan}) בבניין`,
    floorNote:
      'מיקום הדירות בקומה (כיווני אוויר, שכנות, קרבה למעלית) לא מופיע בקובץ המחירים. הוא יתווסף מתשריטי הקומות.',
    colUnit: 'דירה',
    colFloor: 'קומה',
    colSale: 'סוג',
    colRooms: 'חדרים',
    colArea: 'מ״ר',
    colPrice: 'מחיר',
    goTo: (unit: number, building: string) => `מעבר לדירה ${unit} בבניין ${building}`,
  },

  schematic: {
    bannerStrong: 'הדמיה סכמטית.',
    banner:
      ' החלוקה לחדרים נוצרה אוטומטית משטח הדירה ומספר החדרים, והיא לא התוכנית האמיתית של הקבלן. מידות החדרים הן הערכה.',
    hint: 'גררו לסיבוב, צביטה לזום',
    stageLabel: 'הדמיה תלת־ממדית של הדירה',
    orientation: 'לאן פונה חזית הסלון? (לפי התשריט)',
    unknown: 'לא ידוע',
    presets: { 9: 'בוקר 09:00', 12: 'צהריים 12:00', 16: 'אחה״צ 16:00' },
    presetsLabel: 'שעות מוכנות',
    hour: 'שעה סולארית',
    seasonsLabel: 'עונה',
    sunUp: 'גובה השמש',
    sunDir: 'השמש בכיוון',
    sunDown: 'השמש מתחת לאופק',
    sunHoursPrefix: 'שמש ישירה בסלון: ',
    sunHoursWinter: ' שעות בחורף, ',
    sunHoursSummer: ' בקיץ. הערכה לפי כיוון בלבד, ללא הצללה מבניינים סמוכים.',
    pickDirection: 'בחרו כיוון כדי להפעיל את סימולציית השמש. הכיוון לא מופיע בקובץ המחירים.',
    autoRotate: 'סיבוב 360° אוטומטי',
    labels: 'תוויות חדרים',
    roomsTitle: 'חדרים ומידות (הערכה)',
    colRoom: 'חדר',
    colSize: 'מידות',
    colArea: 'שטח',
    size: (w: string, d: string) => `${w} × ${d} מ׳`,
    area: (a: string) => `${a} מ״ר`,
    labelSize: (w: string, d: string) => `${w}×${d} מ׳`,
    north: 'צפון',
    loading: 'טוען הדמיה…',
    loadFailed: 'לא ניתן לטעון את רכיב התלת־ממד.',
    noWebgl: 'הדפדפן לא תומך בתצוגת תלת־ממד.',
  },

  myList: {
    title: 'הרשימה שלי לפי עדיפות',
    export: 'ייצוא לאקסל',
    saved: 'נשמר במכשיר הזה',
    empty: 'הרשימה ריקה. סמנו דירות בכוכב כדי להוסיף אותן, ואז סדרו לפי העדיפות ליום הבחירה.',
    itemHeading: (building: string, unit: number, floor: string) =>
      `בניין ${building} · דירה ${unit} · קומה ${floor}`,
    itemPriced: (rooms: number, area: string, price: string, perSqm: string, pct: string) =>
      `${rooms} חדרים · ${area} מ״ר · ${price} · ${perSqm} ₪ למ״ר · ${pct}`,
    itemFree: (rooms: number, area: string) =>
      `${rooms} חדרים · ${area} מ״ר · שוק חופשי, מחיר לא פורסם`,
    moveUp: 'העלאה בעדיפות',
    moveDown: 'הורדה בעדיפות',
    remove: 'הסרה מהרשימה',
    notePlaceholder: 'הערות (למשל: שאלות לקבלן, יתרונות וחסרונות)',
    noteLabel: (unit: number, building: string) => `הערות לדירה ${unit} בבניין ${building}`,
    emptyToast: 'הרשימה ריקה',
    savedToast: 'הקובץ נשמר',
    exportFailed: 'הייצוא נכשל',
  },

  exportSheet: {
    sheetName: 'הרשימה שלי',
    fileBase: 'almogim-priorities',
    head: [
      'עדיפות',
      'בניין',
      'דירה',
      'קומה',
      'חדרים',
      'שטח דירה (מ״ר)',
      'מרפסת / גינה (מ״ר)',
      'סוג דירה',
      'תוכנית',
      'סוג מכר',
      'מחיר (₪)',
      'מחיר למ״ר (₪)',
      'פער מדירות דומות',
      'סוג',
      'מחסן',
      'קומת מחסן',
      'שטח מחסן (מ״ר)',
      'חניות',
      'הערות',
    ],
  },

  data: {
    title: 'נתוני הפרויקט',
    source: 'מקור הנתונים',
    builtIn: (file: string, dev: string, lottery: number, base: string) =>
      `קובץ מובנה: ${file}. יזם: ${dev}. הגרלה ${lottery}. מחיר בסיס למ״ר כולל מע״מ, ללא הנחה: ${base} ₪.`,
    loaded: (file: string, units: number) => `נטען קובץ: ${file}. ${units} דירות.`,
    upload: 'טעינת קובץ מחירים מעודכן',
    reset: 'חזרה לקובץ המובנה',
    loadedMsg: (n: number) => `נטענו ${n} דירות.`,
    skippedMsg: (n: number, first: number) => ` דולגו ${n} שורות לא תקינות (למשל שורה ${first}).`,
    error: (msg: string) => 'שגיאה: ' + msg,
    loadedToast: 'הקובץ נטען',
    summary: 'סיכום לפי בניין',
    colBuilding: 'בניין',
    colPlot: 'מגרש',
    colUnits: 'דירות',
    colFloors: 'קומות',
    colTarget: 'מחיר מטרה',
    colAvgArea: 'מ״ר ממוצע',
    colPriceRange: 'טווח מחירים (₪)',
    floorsRange: (from: string, to: string) => `${from} עד ${to}`,
    priceRange: (min: string, max: string) => `${min} – ${max}`,
  },

  workbook: {
    badHeader: 'מבנה העמודות לא תואם לקובץ המחירים. העמודה הראשונה צריכה להיות ״מספר/שם מבנה״.',
    noRows: 'לא נמצאו שורות תקינות בקובץ.',
    unreadable: 'לא ניתן לקרוא את הקובץ.',
  },
} as const;

export type Strings = typeof he;
