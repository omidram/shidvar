export type RuleField = {
  key: string;
  title: string;
  body: string;
  kind: "boolean" | "number" | "weights";
  unit?: string;
  live?: boolean;
  weights?: Array<{ key: string; title: string }>;
};

export type RuleGroup = {
  id: string;
  title: string;
  body: string;
  fields: RuleField[];
};

export const RULE_GROUPS: RuleGroup[] = [
  {
    id: "matching",
    title: "تطبیق بار و راننده",
    body: "وقتی درخواست منتشر می‌شود، سیستم به هر راننده یا شرکت یک امتیاز می‌دهد. این وزن‌ها سهم هر معیار را در آن امتیاز مشخص می‌کنند. اگر امتیاز از حداقل پایین‌تر باشد، اعلان ارسال نمی‌شود.",
    fields: [
      {
        key: "matching.minScoreToNotify",
        title: "حداقل امتیاز برای اعلان",
        body: "راننده یا شرکت فقط وقتی خبردار می‌شود که امتیاز تطبیق‌اش از این عدد بیشتر باشد.",
        kind: "number",
        unit: "از ۱۰۰",
        live: true,
      },
      {
        key: "matching.driver.weights",
        title: "وزن معیارهای راننده",
        body: "سهم هر عامل در انتخاب راننده: تناسب ناوگان، فاصله، محدوده، امتیاز و تأیید حساب.",
        kind: "weights",
        live: true,
        weights: [
          { key: "vehicleFit", title: "تناسب نوع ناوگان" },
          { key: "capacityFit", title: "تناسب ظرفیت" },
          { key: "pickupDistance", title: "نزدیکی به مبدأ" },
          { key: "areaFit", title: "پوشش محدوده" },
          { key: "ratingScore", title: "امتیاز راننده" },
          { key: "reliabilityScore", title: "قابلیت اطمینان" },
          { key: "availability", title: "آمادگی زمانی" },
          { key: "equipmentFit", title: "تجهیزات" },
          { key: "workloadScore", title: "بار کاری فعلی" },
          { key: "verificationScore", title: "تأیید حساب" },
        ],
      },
      {
        key: "matching.supplier.weights",
        title: "وزن معیارهای شرکت پخش",
        body: "اگر بازار تأمین‌کننده فعال باشد، این وزن‌ها امتیاز تطبیق کاتالوگ و ظرفیت را می‌سازند.",
        kind: "weights",
        live: true,
        weights: [
          { key: "productCompatibility", title: "سازگاری کالا" },
          { key: "capacityCompatibility", title: "ظرفیت تأمین" },
          { key: "geographicCompatibility", title: "پوشش جغرافیایی" },
          { key: "certificationCompatibility", title: "گواهی‌ها" },
          { key: "priceScore", title: "قیمت" },
          { key: "ratingScore", title: "امتیاز" },
          { key: "reliabilityScore", title: "قابلیت اطمینان" },
          { key: "deliveryScore", title: "تحویل به‌موقع" },
          { key: "workloadScore", title: "بار کاری" },
          { key: "verificationScore", title: "تأیید حساب" },
        ],
      },
    ],
  },
  {
    id: "flow",
    title: "انتشار درخواست و قبول بار",
    body: "این‌ها رفتار گردش کار را عوض می‌کنند: درخواست بعد از ثبت منتشر شود یا نه، پیشنهاد تا کی معتبر بماند، و آیا یک برنده کافی است.",
    fields: [
      {
        key: "requests.autoPublish",
        title: "انتشار خودکار درخواست",
        body: "اگر روشن باشد، بعد از ثبت درخواست، همان لحظه به رانندگان محدوده اعلام می‌شود. اگر خاموش باشد، صاحب بار باید خودش منتشر کند.",
        kind: "boolean",
        live: true,
      },
      {
        key: "offers.maxValidityHours",
        title: "اعتبار پیشنهاد",
        body: "پیشنهاد ثبت‌شده بعد از این مدت منقضی می‌شود.",
        kind: "number",
        unit: "ساعت",
        live: true,
      },
      {
        key: "offers.allowPartialQuantity",
        title: "قبول مقدار جزئی",
        body: "اجازه می‌دهد پیشنهاد کمتر از کل مقدار درخواستی ثبت شود.",
        kind: "boolean",
        live: true,
      },
      {
        key: "fulfillment.singleWinner",
        title: "فقط یک برنده",
        body: "با روشن بودن، بعد از قبول یک پیشنهاد بقیه پیشنهادهای باز رد می‌شوند.",
        kind: "boolean",
        live: true,
      },
      {
        key: "jobs.requireSupplierConfirm",
        title: "تأیید نهایی تخصیص",
        body: "اگر روشن باشد، تخصیص راننده قبل از آزاد شدن جزئیات بار یک مرحله تأیید دارد.",
        kind: "boolean",
        live: false,
      },
      {
        key: "jobs.opportunityExpiryMinutes",
        title: "مهلت قبول بار",
        body: "راننده این مدت وقت دارد بار پیشنهادی را قبول یا رد کند.",
        kind: "number",
        unit: "دقیقه",
        live: false,
      },
    ],
  },
  {
    id: "money",
    title: "کارمزد",
    body: "درصدی که هنگام محاسبه کارمزد حمل و خدمات روی مبلغ پایه اعمال می‌شود.",
    fields: [
      {
        key: "commission.transport.percent",
        title: "کارمزد حمل",
        body: "درصد کارمزد روی کرایه حمل.",
        kind: "number",
        unit: "درصد",
        live: false,
      },
      {
        key: "commission.supplier.percent",
        title: "کارمزد خدمات",
        body: "درصد کارمزد روی خدمات جانبی یا تأمین.",
        kind: "number",
        unit: "درصد",
        live: false,
      },
    ],
  },
  {
    id: "auth",
    title: "ورود و امنیت",
    body: "بعد از چند ورود اشتباه حساب قفل می‌شود و تا پایان این مدت دوباره باز نمی‌شود.",
    fields: [
      {
        key: "auth.maxFailedLogins",
        title: "حداکثر ورود ناموفق",
        body: "پس از این تعداد رمز اشتباه، حساب موقتاً قفل می‌شود.",
        kind: "number",
        unit: "بار",
        live: true,
      },
      {
        key: "auth.lockoutMinutes",
        title: "مدت قفل حساب",
        body: "حساب قفل‌شده بعد از این زمان دوباره قابل ورود است.",
        kind: "number",
        unit: "دقیقه",
        live: true,
      },
    ],
  },
];
