
document.addEventListener("DOMContentLoaded", () => {
    const section = document.querySelector(".qa-section");

    if (!section) return;

    const questionForm = document.getElementById("qa-question-form");
    const questionList = document.getElementById("qa-list");

    if (!questionForm || !questionList) return;

    // شناسایی مقاله
    let articleSlug = section.dataset.article;

    if (!articleSlug || articleSlug === "unknown") {
        articleSlug = new URLSearchParams(location.search).get("slug");
    }

    if (!articleSlug) {
        questionList.textContent = "شناسه مقاله مشخص نیست.";
        return;
    }

    // بررسی اتصال Supabase
    if (typeof supabaseClient === "undefined") {
        questionList.textContent =
            "اتصال به پایگاه داده برقرار نشد. تنظیمات Supabase را بررسی کنید.";
        return;
    }

    const db = supabaseClient;

    // پیام وضعیت
    const statusMessage = document.createElement("p");
    statusMessage.className = "qa-status";
    statusMessage.setAttribute("role", "status");

    questionForm.insertAdjacentElement("afterend", statusMessage);

    function showMessage(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.style.color = isError ? "#a33b32" : "#58745b";
    }

    // ساخت امن عناصر
    function createText(tag, className, value) {
        const element = document.createElement(tag);

        element.className = className;
        element.textContent = value ?? "";

        return element;
    }

    // دریافت پرسش‌ها و پاسخ‌ها
    async function getQuestions() {
        const { data: questions, error: questionError } = await db
            .from("qa_questions")
            .select("id, article_slug, name, question, created_at")
            .eq("article_slug", articleSlug)
            .order("created_at", { ascending: true });

        if (questionError) throw questionError;

        if (!questions || questions.length === 0) {
            return [];
        }

        const questionIds = questions.map(item => item.id);

        const { data: answers, error: answerError } = await db
            .from("qa_answers")
            .select("id, question_id, name, answer, created_at")
            .in("question_id", questionIds)
            .order("created_at", { ascending: true });

        if (answerError) throw answerError;

        return questions.map(question => ({
            ...question,
            answers: (answers || []).filter(
                answer => answer.question_id === question.id
            )
        }));
    }

    // نمایش پرسش‌ها و پاسخ‌ها
    async function renderQuestions() {
        questionList.replaceChildren();

        showMessage("در حال دریافت پرسش‌ها...");

        try {
            const questions = await getQuestions();

            questionList.replaceChildren();

            if (questions.length === 0) {
                questionList.append(
                    createText(
                        "p",
                        "qa-empty",
                        "هنوز پرسشی ثبت نشده است. اولین نفر باشید!"
                    )
                );

                showMessage("");
                return;
            }

            // جدیدترین پرسش در ابتدا
            questions.slice().reverse().forEach(question => {
                const card = document.createElement("div");
                card.className = "qa-card";

                card.append(
                    createText("strong", "qa-name", question.name),
                    createText("p", "qa-question", question.question)
                );

                // بخش پاسخ‌ها
                const answersContainer = document.createElement("div");
                answersContainer.className = "qa-answers";

                if (!question.answers.length) {
                    answersContainer.append(
                        createText(
                            "p",
                            "qa-empty",
                            "هنوز پاسخی برای این سؤال ثبت نشده است."
                        )
                    );
                }

                question.answers.forEach(answer => {
                    const answerBox = document.createElement("div");
                    answerBox.className = "qa-answer";

                    answerBox.append(
                        createText(
                            "strong",
                            "qa-answer-name",
                            answer.name
                        ),
                        createText(
                            "p",
                            "qa-answer-text",
                            answer.answer
                        )
                    );

                    answersContainer.append(answerBox);
                });

                card.append(answersContainer);

                // فرم پاسخ به پرسش
                const replyForm = document.createElement("form");
                replyForm.className = "qa-reply-form";

                const nameInput = document.createElement("input");
                nameInput.type = "text";
                nameInput.placeholder = "نام شما";
                nameInput.maxLength = 30;
                nameInput.required = true;

                const answerInput = document.createElement("input");
                answerInput.type = "text";
                answerInput.placeholder = "پاسخ شما...";
                answerInput.maxLength = 500;
                answerInput.required = true;

                const replyButton = document.createElement("button");
                replyButton.type = "submit";
                replyButton.textContent = "ثبت پاسخ";

                replyForm.append(
                    nameInput,
                    answerInput,
                    replyButton
                );

                // ارسال پاسخ
                replyForm.addEventListener("submit", async event => {
                    event.preventDefault();

                    const name = nameInput.value.trim();
                    const answer = answerInput.value.trim();

                    if (!name || !answer) return;

                    if (name.length > 30 || answer.length > 500) {
                        showMessage("طول متن واردشده بیش از حد مجاز است.", true);
                        return;
                    }

                    replyButton.disabled = true;
                    replyButton.textContent = "در حال ثبت...";

                    try {
                        const { error } = await db
                            .from("qa_answers")
                            .insert({
                                question_id: question.id,
                                name: name,
                                answer: answer
                            });

                        if (error) throw error;

                        showMessage("پاسخ شما با موفقیت ثبت شد.");

                        await renderQuestions();

                    } catch (error) {
                        console.error("Answer error:", error);

                        showMessage(
                            "ثبت پاسخ انجام نشد. لطفاً دوباره تلاش کنید.",
                            true
                        );

                        replyButton.disabled = false;
                        replyButton.textContent = "ثبت پاسخ";
                    }
                });

                card.append(replyForm);
                questionList.append(card);
            });

            showMessage("");

        } catch (error) {
            console.error("QA loading error:", error);

            questionList.replaceChildren(
                createText(
                    "p",
                    "qa-empty",
                    "دریافت پرسش‌ها با مشکل مواجه شد. لطفاً دوباره صفحه را بارگذاری کنید."
                )
            );

            showMessage("خطا در ارتباط با پایگاه داده.", true);
        }
    }

    // ثبت پرسش جدید
    questionForm.addEventListener("submit", async event => {
        event.preventDefault();

        const nameInput = document.getElementById("qa-name");
        const questionInput = document.getElementById("qa-question");

        const name = nameInput?.value.trim();
        const question = questionInput?.value.trim();

        if (!name || !question) {
            showMessage("لطفاً نام و متن پرسش را وارد کنید.", true);
            return;
        }

        if (name.length > 30 || question.length > 1000) {
            showMessage("طول متن واردشده بیش از حد مجاز است.", true);
            return;
        }

        const submitButton = questionForm.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "در حال ثبت...";
        }

        showMessage("در حال ثبت پرسش...");

        try {
            const { error } = await db
                .from("qa_questions")
                .insert({
                    article_slug: articleSlug,
                    name: name,
                    question: question
                });

            if (error) throw error;

            questionForm.reset();

            showMessage("پرسش شما با موفقیت ثبت شد.");

            await renderQuestions();

        } catch (error) {
            console.error("Question error:", error);

            showMessage(
                "ثبت پرسش انجام نشد. لطفاً دوباره تلاش کنید.",
                true
            );

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "ثبت پرسش";
            }
        }
    });

    // دریافت اولیه پرسش‌ها
    renderQuestions();
});
