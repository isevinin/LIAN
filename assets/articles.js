
document.addEventListener("DOMContentLoaded", async () => {
    const articleGrid = document.querySelector(".article-grid");

    // اگر صفحه اصلی یا بخش مقالات وجود نداشت، اجرا متوقف شود.
    if (!articleGrid || typeof supabaseClient === "undefined") return;

    // اسلاگ چهار مقاله ثابت فعلی؛ از نمایش تکراری آن‌ها جلوگیری می‌کنیم.
    const existingSlugs = [
        "orsi",
        "design",
        "process",
        "why-lian-is-different"
    ];

    // طرح‌های گرافیکی موجود در کارت‌های فعلی لیان
    const visualStyles = [
        "visual-one",
        "visual-two",
        "visual-three"
    ];

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function createArticleCard(article) {
        const card = createElement("article", "article-card");

        // انتخاب تصادفی یکی از طرح‌های فعلی
        const randomStyle =
            visualStyles[Math.floor(Math.random() * visualStyles.length)];

        const visual = createElement(
            "div",
            `article-visual ${randomStyle}`
        );

        // المان تزئینی هماهنگ با طرح‌های فعلی
        visual.appendChild(createElement("div", "window-pattern"));

        const info = createElement("div", "article-info");

        const category = createElement(
            "span",
            "article-category",
            article.category || "مجله لیان"
        );

        const title = createElement("h3", "", article.title);

        const excerpt = createElement(
            "p",
            "",
            article.excerpt || ""
        );

        const link = createElement(
            "a",
            "",
            "مطالعه مقاله"
        );

        link.href =
            "articles/article.html?slug=" +
            encodeURIComponent(article.slug);

        info.append(category, title, excerpt, link);
        card.append(visual, info);

        return card;
    }

    async function loadPublishedArticles() {
        const { data, error } = await supabaseClient
            .from("articles")
            .select("id, title, slug, category, excerpt, status, created_at")
            .eq("status", "published")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("خطا در دریافت مقالات:", error);
            return;
        }

        if (!data || data.length === 0) return;

        // حذف مقالاتی که از قبل به‌صورت ثابت در صفحه اصلی هستند
        const newArticles = data.filter(article =>
            article.slug &&
            !existingSlugs.includes(article.slug)
        );

        newArticles.forEach(article => {
            // جلوگیری از ساخت کارت تکراری
            const alreadyExists = articleGrid.querySelector(
                `[data-article-slug="${CSS.escape(article.slug)}"]`
            );

            if (alreadyExists) return;

            const card = createArticleCard(article);
            card.dataset.articleSlug = article.slug;

            articleGrid.appendChild(card);
        });
    }

    await loadPublishedArticles();
});
