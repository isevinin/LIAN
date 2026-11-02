
document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("commentForm");
    const commentsContainer = document.getElementById("approvedComments");
    const message = document.getElementById("formMessage");

    // اگر صفحه بخش نظرات ندارد، اجرا متوقف شود.
    if (!form && !commentsContainer) return;

    // بررسی اتصال Supabase
    if (typeof supabaseClient === "undefined") {
        showMessage("اتصال به پایگاه داده برقرار نیست.");
        return;
    }

    const db = supabaseClient;
    const HOME_SLUG = "lian-home";

    let articleId = null;
    let articleReady = false;

    const submitButton = form?.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    // دریافت فیلدهای فرم با استفاده از ID یا name
    const authorInput =
        document.getElementById("commentAuthor") ||
        form?.querySelector('[name="author"]');

    const typeInput =
        document.getElementById("commentType") ||
        form?.querySelector('[name="type"], [name="commentType"]');

    const bodyInput =
        document.getElementById("commentBody") ||
        form?.querySelector('[name="body"]');

    // نمایش پیام
    function showMessage(text, success = false) {
        if (!message) return;

        message.textContent = text;
        message.style.color = success ? "#54745b" : "#a33b32";
        message.setAttribute("role", "status");
    }

    // شناسایی مقاله از آدرس صفحه
    function getArticleSlug() {
        const params = new URLSearchParams(location.search);
        const querySlug = params.get("slug");

        if (querySlug) return querySlug;

        const fileName = location.pathname.split("/").pop();

        if (
            !fileName ||
            fileName === "index.html" ||
            !fileName.includes(".")
        ) {
            return HOME_SLUG;
        }

        if (fileName.endsWith(".html")) {
            return fileName.replace(".html", "");
        }

        return HOME_SLUG;
    }

    const articleSlug = getArticleSlug();

    // تبدیل نوع پیام به مقادیر مجاز دیتابیس
    function normalizeType(value) {
        const normalized = String(value || "").trim().toLowerCase();

        const types = {
            comment: "comment",
            "نظر": "comment",
            question: "question",
            "سؤال": "question",
            "سوال": "question",
            suggestion: "suggestion",
            "پیشنهاد": "suggestion"
        };

        return types[normalized] || "comment";
    }

    // تبدیل نوع پیام به متن فارسی
    function getTypeLabel(type) {
        const labels = {
            comment: "نظر",
            question: "سؤال",
            suggestion: "پیشنهاد"
        };

        return labels[type] || "نظر";
    }

    // ساخت امن عناصر HTML
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

    // تبدیل تاریخ به شمسی
    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "";

        return date.toLocaleDateString("fa-IR");
    }

    // پیدا کردن شناسه مقاله در Supabase
    async function findArticle() {
        const { data, error } = await db
            .from("articles")
            .select("id")
            .eq("slug", articleSlug)
            .eq("status", "published")
            .maybeSingle();

        if (error) {
            console.error("Article lookup error:", error);
            showMessage("خطا در شناسایی صفحه.");
            return false;
        }

        if (!data) {
            showMessage("مقاله موردنظر در پایگاه داده پیدا نشد.");
            return false;
        }

        articleId = data.id;
        articleReady = true;

        return true;
    }

    // دریافت نظرات تأییدشده
    async function loadComments() {
        if (!commentsContainer) return;

        commentsContainer.replaceChildren(
            createElement(
                "p",
                "comments-loading",
                "در حال دریافت دیدگاه‌ها..."
            )
        );

        if (!articleReady || !articleId) {
            commentsContainer.replaceChildren(
                createElement(
                    "p",
                    "comments-empty",
                    "صفحه شناسایی نشد."
                )
            );
            return;
        }

        const { data, error } = await db
            .from("comments")
            .select("id, author, body, type, created_at")
            .eq("article_id", articleId)
            .eq("status", "approved")
            .is("parent_id", null)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Comments loading error:", error);

            commentsContainer.replaceChildren(
                createElement(
                    "p",
                    "comments-error",
                    "دریافت دیدگاه‌ها با مشکل مواجه شد."
                )
            );

            return;
        }

        commentsContainer.replaceChildren();

        if (!data || data.length === 0) {
            commentsContainer.append(
                createElement(
                    "p",
                    "comments-empty",
                    "هنوز دیدگاهی ثبت نشده است. اولین نفر باشید!"
                )
            );

            return;
        }

        data.forEach(comment => {
            const card = createElement("article", "comment-card");

            const header = createElement("div", "comment-header");

            const author = createElement(
                "h4",
                "comment-author",
                comment.author || "کاربر لیان"
            );

            const type = createElement(
                "span",
                "comment-type",
                getTypeLabel(comment.type)
            );

            const body = createElement(
                "p",
                "comment-body",
                comment.body || ""
            );

            const date = createElement(
                "span",
                "comment-date",
                formatDate(comment.created_at)
            );

            header.append(author, type);
            card.append(header, body, date);

            commentsContainer.appendChild(card);
        });
    }

    // ثبت نظر جدید
    if (form) {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            const author = authorInput?.value.trim();
            const body = bodyInput?.value.trim();
            const type = normalizeType(typeInput?.value);

            if (!author || !body) {
                showMessage("لطفاً نام و متن پیام را وارد کنید.");
                return;
            }

            if (author.length > 80) {
                showMessage("نام شما نباید بیشتر از ۸۰ نویسه باشد.");
                return;
            }

            if (body.length > 2000) {
                showMessage("متن پیام نباید بیشتر از ۲۰۰۰ نویسه باشد.");
                return;
            }

            if (!articleReady || !articleId) {
                showMessage("امکان شناسایی مقاله وجود ندارد.");
                return;
            }

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "در حال ارسال...";
            }

            showMessage("در حال ثبت پیام...");

            try {
                const { error } = await db
                    .from("comments")
                    .insert({
                        article_id: articleId,
                        parent_id: null,
                        author: author,
                        body: body,
                        type: type,
                        status: "pending"
                    });

                if (error) throw error;

                form.reset();

                showMessage(
                    "پیام شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود.",
                    true
                );

            } catch (error) {
                console.error("Comment insert error:", error);

                showMessage(
                    "ثبت پیام انجام نشد. لطفاً دوباره تلاش کنید."
                );

            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "ارسال پیام";
                }
            }
        });
    }

    // آماده‌سازی صفحه
    const found = await findArticle();

    if (found) {
        await loadComments();
    }
});
