
document.addEventListener("DOMContentLoaded", async () => {

    // ==========================================
    // 1. اتصال به Supabase
    // ==========================================

    const db = window.supabaseClient;

    if (!db) {
        console.error("Supabase client not found!");
        alert("خطا در اتصال به پایگاه داده. فایل supabase.js را بررسی کنید.");
        return;
    }

    // ==========================================
    // 2. عناصر HTML
    // ==========================================

    const $ = id => document.getElementById(id);

    const loginSection = $("loginSection");

    const dashboard =
        $("dashboardSection") ||
        $("dashboard");

    const loginForm = $("loginForm");
    const loginMessage = $("loginMessage");

    const articleForm = $("articleForm");
    const articleMessage = $("articleMessage");
    const articleFormTitle = $("articleFormTitle");

    const articlesTableBody = $("articlesTableBody");
    const commentsTableBody = $("commentsTableBody");

    const cancelEdit = $("cancelEdit");
    const logoutButton = $("logoutButton");

    const refreshCommentsButton = $("refreshComments");

    let articlesCache = [];
    let commentsCache = [];

    // ==========================================
    // 3. توابع کمکی
    // ==========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function showMessage(element, message, type = "success") {
        if (!element) return;

        element.textContent = message;
        element.className = `message ${type}`;
    }

    function clearMessage(element) {
        if (!element) return;

        element.textContent = "";
        element.className = "";
    }

    function formatDate(date) {
        if (!date) return "-";

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) return "-";

        return parsed.toLocaleDateString("fa-IR");
    }

    function setValue(id, value) {
        const element = $(id);

        if (element) element.value = value ?? "";
    }

    function setLoading(button, loading, text) {
        if (!button) return;

        button.disabled = loading;
        button.textContent = loading ? "لطفاً صبر کنید..." : text;
    }

    function showDatabaseError(error, section) {
        console.error(`خطای ${section}:`, error);

        if (error?.code === "42501") {
            return "دسترسی به اطلاعات وجود ندارد. تنظیمات RLS را بررسی کنید.";
        }

        if (error?.code === "42P01") {
            return "جدول موردنظر در پایگاه داده پیدا نشد.";
        }

        if (error?.code === "42703" || error?.code === "PGRST204") {
            return "ساختار ستون‌های جدول با درخواست برنامه مطابقت ندارد.";
        }

        return error?.message || "خطای نامشخص در دریافت اطلاعات.";
    }

    // ==========================================
    // 4. بررسی مدیر
    // ==========================================

    async function isAdmin(user) {

        if (!user) return false;

        const { data, error } = await db
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Admin check error:", error);
            return false;
        }

        return Boolean(data);
    }

    // ==========================================
    // 5. نمایش پنل
    // ==========================================

    function showLogin() {

        if (loginSection) {
            loginSection.style.display = "block";
        }

        if (dashboard) {
            dashboard.hidden = true;
            dashboard.style.display = "none";
        }
    }

    function showPanel(panelId) {

        ["articlesPanel", "commentsPanel"].forEach(id => {

            const panel = $(id);

            if (panel) {
                panel.style.display =
                    id === panelId ? "block" : "none";
            }
        });

        document.querySelectorAll("[data-tab]").forEach(button => {

            const target = button.dataset.tab;

            const active =
                target === panelId ||
                (target === "articles" && panelId === "articlesPanel") ||
                (target === "comments" && panelId === "commentsPanel");

            button.classList.toggle("active", active);
        });
    }

    async function showDashboard() {

        if (loginSection) {
            loginSection.style.display = "none";
        }

        if (dashboard) {
            dashboard.hidden = false;
            dashboard.style.display = "block";
        }

        showPanel("articlesPanel");

        await Promise.all([
            loadArticles(),
            loadComments()
        ]);
    }

    document.querySelectorAll("[data-tab]").forEach(button => {

        button.addEventListener("click", async () => {

            const target = button.dataset.tab;

            const panelId =
                target === "articles" ? "articlesPanel" :
                target === "comments" ? "commentsPanel" :
                target;

            showPanel(panelId);

            if (panelId === "commentsPanel") {
                await loadComments();
            }
        });
    });

    // ==========================================
    // 6. ورود مدیر
    // ==========================================

    if (loginForm) {

        loginForm.addEventListener("submit", async event => {

            event.preventDefault();

            clearMessage(loginMessage);

            const email = $("email")?.value.trim();
            const password = $("password")?.value;

            if (!email || !password) {
                showMessage(
                    loginMessage,
                    "ایمیل و رمز عبور را وارد کنید.",
                    "error"
                );
                return;
            }

            const button = loginForm.querySelector(
                'button[type="submit"]'
            );

            setLoading(button, true, "ورود");

            try {

                const { data, error } = await db.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                if (!await isAdmin(data.user)) {

                    await db.auth.signOut();

                    showMessage(
                        loginMessage,
                        "شما اجازه دسترسی به پنل مدیریت را ندارید.",
                        "error"
                    );

                    return;
                }

                showMessage(loginMessage, "ورود موفقیت‌آمیز بود.");

                await showDashboard();

            } catch (error) {

                console.error("Login error:", error);

                showMessage(
                    loginMessage,
                    "ورود ناموفق بود. اطلاعات حساب را بررسی کنید.",
                    "error"
                );

            } finally {

                setLoading(button, false, "ورود");
            }
        });
    }

    // ==========================================
    // 7. خروج مدیر
    // ==========================================

    if (logoutButton) {

        logoutButton.addEventListener("click", async () => {

            try {

                const { error } = await db.auth.signOut();

                if (error) throw error;

                resetArticleForm();
                showLogin();

            } catch (error) {

                console.error("Logout error:", error);
                alert("خروج از حساب ناموفق بود.");
            }
        });
    }

    // ==========================================
    // 8. بازیابی رمز
    // ==========================================

    const forgotPasswordButton = $("forgotPasswordButton");

    if (forgotPasswordButton) {

        forgotPasswordButton.addEventListener("click", async () => {

            const email = $("email")?.value.trim();

            if (!email) {
                showMessage(
                    loginMessage,
                    "ابتدا ایمیل را وارد کنید.",
                    "error"
                );
                return;
            }

            try {

                const { error } = await db.auth.resetPasswordForEmail(email);

                if (error) throw error;

                showMessage(
                    loginMessage,
                    "لینک بازیابی رمز عبور ارسال شد."
                );

            } catch (error) {

                console.error(error);

                showMessage(
                    loginMessage,
                    "ارسال ایمیل بازیابی ناموفق بود.",
                    "error"
                );
            }
        });
    }

    // ==========================================
    // 9. دریافت مقالات
    // ==========================================

    async function loadArticles() {

        if (!articlesTableBody) return;

        articlesTableBody.innerHTML =
            '<tr><td colspan="5">در حال دریافت مقالات...</td></tr>';

        try {

            const { data, error } = await db
                .from("articles")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            articlesCache = data || [];

            if (!articlesCache.length) {
                articlesTableBody.innerHTML =
                    '<tr><td colspan="5">هنوز مقاله‌ای ثبت نشده است.</td></tr>';
                return;
            }

            articlesTableBody.innerHTML = articlesCache.map(article => `

                <tr>
                    <td>${escapeHTML(article.title)}</td>
                    <td>${escapeHTML(article.category || "-")}</td>
                    <td>${article.status === "published" ? "منتشر شده" : "پیش‌نویس"}</td>
                    <td>${formatDate(article.created_at)}</td>
                    <td>
                        <button type="button" data-action="edit-article"
                            data-id="${escapeHTML(article.id)}">ویرایش</button>

                        <button type="button" data-action="delete-article"
                            data-id="${escapeHTML(article.id)}">حذف</button>
                    </td>
                </tr>

            `).join("");

        } catch (error) {

            articlesTableBody.innerHTML =
                `<tr><td colspan="5">${escapeHTML(showDatabaseError(error, "مقالات"))}</td></tr>`;
        }
    }

    // ==========================================
    // 10. ذخیره مقاله
    // ==========================================

    if (articleForm) {

        articleForm.addEventListener("submit", async event => {

            event.preventDefault();

            clearMessage(articleMessage);

            const title = $("articleTitle")?.value.trim();
            const slug = $("articleSlug")?.value.trim();
            const category = $("articleCategory")?.value.trim();
            const image = $("articleImage")?.value.trim();
            const excerpt = $("articleExcerpt")?.value.trim();
            const content = $("articleContent")?.value.trim();
            const status = $("articleStatus")?.value;

            if (!title || !slug || !content) {
                showMessage(
                    articleMessage,
                    "عنوان، نشانی و متن مقاله الزامی هستند.",
                    "error"
                );
                return;
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
                showMessage(
                    articleMessage,
                    "نشانی مقاله باید انگلیسی و بدون فاصله باشد.",
                    "error"
                );
                return;
            }

            if (!["draft", "published"].includes(status)) {
                showMessage(
                    articleMessage,
                    "وضعیت مقاله معتبر نیست.",
                    "error"
                );
                return;
            }

            const editingId = articleForm.dataset.editingId;

            if (articlesCache.some(article =>
                article.slug === slug &&
                String(article.id) !== String(editingId || "")
            )) {
                showMessage(
                    articleMessage,
                    "این نشانی قبلاً ثبت شده است.",
                    "error"
                );
                return;
            }

            const payload = {
                title,
                slug,
                category,
                cover_image: image || null,
                excerpt,
                content,
                status,
                updated_at: new Date().toISOString()
            };

            const button = articleForm.querySelector(
                'button[type="submit"]'
            );

            setLoading(button, true, "ذخیره مقاله");

            try {

                const result = editingId
                    ? await db.from("articles").update(payload).eq("id", editingId)
                    : await db.from("articles").insert([payload]);

                if (result.error) throw result.error;

                showMessage(
                    articleMessage,
                    status === "published"
                        ? "مقاله منتشر شد."
                        : "پیش‌نویس ذخیره شد."
                );

                resetArticleForm();
                await loadArticles();

            } catch (error) {

                console.error("Article save error:", error);

                showMessage(
                    articleMessage,
                    "ذخیره مقاله ناموفق بود.",
                    "error"
                );

            } finally {

                setLoading(button, false, "ذخیره مقاله");
            }
        });
    }

    // ==========================================
    // 11. پاک کردن فرم مقاله
    // ==========================================

    function resetArticleForm() {

        articleForm?.reset();

        if (articleForm) {
            delete articleForm.dataset.editingId;
        }

        if (articleFormTitle) {
            articleFormTitle.textContent = "افزودن مقاله جدید";
        }

        if (cancelEdit) {
            cancelEdit.style.display = "none";
        }

        clearMessage(articleMessage);
    }

    cancelEdit?.addEventListener("click", resetArticleForm);

    // ==========================================
    // 12. ویرایش مقاله
    // ==========================================

    function editArticle(id) {

        const article = articlesCache.find(
            item => String(item.id) === String(id)
        );

        if (!article) return;

        setValue("articleTitle", article.title);
        setValue("articleSlug", article.slug);
        setValue("articleCategory", article.category);
        setValue("articleImage", article.cover_image);
        setValue("articleExcerpt", article.excerpt);
        setValue("articleContent", article.content);
        setValue("articleStatus", article.status);

        articleForm.dataset.editingId = article.id;

        if (articleFormTitle) {
            articleFormTitle.textContent = "ویرایش مقاله";
        }

        if (cancelEdit) {
            cancelEdit.style.display = "inline-block";
        }

        articleForm.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    // ==========================================
    // 13. حذف مقاله
    // ==========================================

    async function deleteArticle(id) {

        if (!confirm("آیا از حذف مقاله مطمئن هستید؟")) return;

        try {

            const { error } = await db
                .from("articles")
                .delete()
                .eq("id", id);

            if (error) throw error;

            if (String(articleForm?.dataset.editingId) === String(id)) {
                resetArticleForm();
            }

            await loadArticles();

        } catch (error) {

            console.error(error);
            alert("حذف مقاله ناموفق بود.");
        }
    }

    articlesTableBody?.addEventListener("click", event => {

        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const { id, action } = button.dataset;

        if (action === "edit-article") editArticle(id);
        if (action === "delete-article") deleteArticle(id);
    });

    // ==========================================
    // 14. دریافت نظرات کاربران
    // ==========================================

    async function loadComments() {

        if (!commentsTableBody) {
            console.error("commentsTableBody not found in HTML!");
            return;
        }

        commentsTableBody.innerHTML =
            '<tr><td colspan="6">در حال دریافت نظرات کاربران...</td></tr>';

        try {

            const { data, error } = await db
                .from("comments")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            commentsCache = data || [];

            console.log("Comments loaded:", commentsCache);

            if (!commentsCache.length) {

                commentsTableBody.innerHTML =
                    '<tr><td colspan="6">هنوز نظری ثبت نشده است.</td></tr>';

                return;
            }

            commentsTableBody.innerHTML = commentsCache.map(comment => {

                const status = comment.status || "pending";

                const statusLabel = {
                    approved: "تأیید شده",
                    rejected: "رد شده",
                    pending: "در انتظار تأیید"
                }[status] || escapeHTML(status);

                return `
                    <tr>

                        <td>${escapeHTML(comment.author || "بدون نام")}</td>

                        <td>${escapeHTML(comment.body || comment.content || comment.message || "-")}</td>

                        <td>${escapeHTML(comment.type || "نظر")}</td>

                        <td>${statusLabel}</td>

                        <td>${formatDate(comment.created_at)}</td>

                        <td>

                            <button
                                type="button"
                                data-action="approve-comment"
                                data-id="${escapeHTML(comment.id)}">
                                تأیید
                            </button>

                            <button
                                type="button"
                                data-action="reject-comment"
                                data-id="${escapeHTML(comment.id)}">
                                رد
                            </button>

                            <button
                                type="button"
                                data-action="delete-comment"
                                data-id="${escapeHTML(comment.id)}">
                                حذف
                            </button>

                        </td>

                    </tr>
                `;
            }).join("");

        } catch (error) {

            const message = showDatabaseError(error, "نظرات");

            commentsTableBody.innerHTML = `
                <tr>
                    <td colspan="6">${escapeHTML(message)}</td>
                </tr>
            `;
        }
    }

    // ==========================================
    // 15. تأیید و رد نظر
    // ==========================================

    async function updateCommentStatus(id, status) {

        try {

            const { error } = await db
                .from("comments")
                .update({ status })
                .eq("id", id);

            if (error) throw error;

            await loadComments();

        } catch (error) {

            console.error("Comment status error:", error);
            alert(showDatabaseError(error, "تغییر وضعیت نظر"));
        }
    }

    // ==========================================
    // 16. حذف نظر
    // ==========================================

    async function deleteComment(id) {

        if (!confirm("آیا از حذف این نظر مطمئن هستید؟")) return;

        try {

            const { error } = await db
                .from("comments")
                .delete()
                .eq("id", id);

            if (error) throw error;

            await loadComments();

        } catch (error) {

            console.error("Comment delete error:", error);
            alert(showDatabaseError(error, "حذف نظر"));
        }
    }

    // ==========================================
    // 17. دکمه‌های مدیریت نظرات
    // ==========================================

    commentsTableBody?.addEventListener("click", event => {

        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const { id, action } = button.dataset;

        if (action === "approve-comment") {
            updateCommentStatus(id, "approved");
        }

        if (action === "reject-comment") {
            updateCommentStatus(id, "rejected");
        }

        if (action === "delete-comment") {
            deleteComment(id);
        }
    });

    // ==========================================
    // 18. بارگذاری مجدد نظرات
    // ==========================================

    refreshCommentsButton?.addEventListener("click", loadComments);

    // ==========================================
    // 19. بررسی نشست مدیر
    // ==========================================

    try {

        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        const user = data?.session?.user;

        if (!user) {
            showLogin();
            return;
        }

        const allowed = await isAdmin(user);

        if (!allowed) {
            await db.auth.signOut();
            showLogin();
            return;
        }

        await showDashboard();

    } catch (error) {

        console.error("Session error:", error);
        showLogin();
    }

});
