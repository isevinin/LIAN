
(function () {
    // جلوگیری از ایجاد دکمه تکراری
    if (document.querySelector(".home-back-button")) {
        return;
    }

    // تشخیص مسیر پوشه اصلی پروژه از روی محل فایل navigation.js
    const scriptUrl = document.currentScript.src;
    const projectRoot = new URL("../", scriptUrl);
    const homeUrl = new URL("index.html", projectRoot).href;

    // ساخت دکمه بازگشت
    const backButton = document.createElement("a");

    backButton.href = homeUrl;
    backButton.className = "home-back-button";
    backButton.title = "بازگشت به صفحه اصلی";
    backButton.setAttribute("aria-label", "بازگشت به صفحه اصلی");

    backButton.innerHTML = `
        <span aria-hidden="true">←</span>
    `;

    // ساخت استایل دکمه
    const style = document.createElement("style");

    style.textContent = `
        .home-back-button {
            position: fixed;
            top: 25px;
            right: 25px;
            width: 46px;
            height: 46px;

            display: flex;
            align-items: center;
            justify-content: center;

            background: #fffdf8;
            color: #172638;

            border: 1px solid #b89a64;
            border-radius: 50%;

            font-family: "Vazirmatn", Tahoma, sans-serif;
            font-size: 25px;
            font-weight: 400;

            text-decoration: none;
            box-shadow: 0 4px 15px rgba(23, 38, 56, 0.10);

            z-index: 9999;
            transition: all 0.3s ease;
        }

        .home-back-button:hover {
            background: #172638;
            color: #b89a64;
            transform: translateX(-4px);
        }

        .home-back-button:focus-visible {
            outline: 3px solid #b89a64;
            outline-offset: 4px;
        }

        @media (max-width: 600px) {
            .home-back-button {
                width: 40px;
                height: 40px;
                top: 15px;
                right: 15px;
                font-size: 22px;
            }
        }
    `;

    // اضافه کردن استایل و دکمه به صفحه
    document.head.appendChild(style);
    document.body.appendChild(backButton);

})();
