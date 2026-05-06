// app.js
(() => {
    const $ = (id) => document.getElementById(id);

    const apiBaseEl = $("apiBase");           // 例如: https://www.kuyaoapi.com
    const apiKeyEl = $("apiKey");
    const modelEl = $("model");               // dall-e-3 / gpt-image-1 / dall-e-2
    const promptEl = $("prompt");
    const sizeEl = $("size");                 // 1024x1024 / 1792x1024 / ...
    const qualityEl = $("quality");           // standard / hd / auto / high...
    const styleEl = $("style");               // vivid / natural
    const responseFormatEl = $("responseFormat"); // url / b64_json

    const generateBtn = $("generateBtn");
    const statusEl = $("status");
    const errorEl = $("error");
    const resultImgEl = $("resultImg");
    const rawOutputEl = $("rawOutput");

    const requiredIds = [
        "apiBase","apiKey","model","prompt","size","quality","style","responseFormat",
        "generateBtn","status","error","resultImg","rawOutput"
    ];
    const missing = requiredIds.filter(id => !$(id));
    if (missing.length) {
        console.error("缺少页面元素ID:", missing.join(", "));
        return;
    }

    function setStatus(msg = "") { statusEl.textContent = msg; }
    function setError(msg = "") { errorEl.textContent = msg; }
    function setRaw(objOrText = "") {
        rawOutputEl.textContent =
            typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText, null, 2);
    }
    function resetImage() {
        resultImgEl.src = "";
        resultImgEl.style.display = "none";
    }
    function showImage(src) {
        resultImgEl.src = src;
        resultImgEl.style.display = "block";
    }

    function normalizeBase(url) {
        return (url || "").trim().replace(/\/+$/, "");
    }

    generateBtn.addEventListener("click", async () => {
        setError("");
        setStatus("");
        setRaw("");
        resetImage();

        const apiBase = normalizeBase(apiBaseEl.value);
        const apiKey = apiKeyEl.value.trim();
        const model = modelEl.value.trim();
        const prompt = promptEl.value.trim();
        const size = sizeEl.value.trim();
        const quality = qualityEl.value.trim();
        const style = styleEl.value.trim();
        const response_format = responseFormatEl.value.trim(); // url or b64_json

        if (!apiBase) return setError("请输入 API Base，例如 https://www.kuyaoapi.com");
        if (!apiKey) return setError("请输入 API Key");
        if (!prompt) return setError("请输入 Prompt");

        // 组装请求体（只传有值参数，避免不支持参数导致报错）
        const body = { prompt };
        if (model) body.model = model;
        if (size) body.size = size;
        if (quality) body.quality = quality;
        if (style && model === "dall-e-3") body.style = style; // style一般仅dall-e-3支持
        if (response_format) body.response_format = response_format;

        const url = `${apiBase}/v1/images/generations`;

        generateBtn.disabled = true;
        setStatus("生成中，请稍候...");

        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            const text = await resp.text();
            let data = null;
            try { data = JSON.parse(text); } catch (_) {}

            setRaw(data || text);

            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status} - ${text}`);
            }

            const item = data?.data?.[0];
            if (!item) throw new Error("返回中没有 data[0]");

            if (item.url) {
                showImage(item.url);
            } else if (item.b64_json) {
                showImage(`data:image/png;base64,${item.b64_json}`);
            } else {
                throw new Error("返回中没有 url 或 b64_json");
            }

            setStatus("生成成功");
        } catch (err) {
            console.error(err);
            if (String(err.message).includes("Failed to fetch")) {
                setError("Failed to fetch：通常是 CORS 或网络问题。若服务商不允许浏览器直连，请改后端代理。");
            } else {
                setError(`生成失败：${err.message}`);
            }
            setStatus("");
        } finally {
            generateBtn.disabled = false;
        }
    });
})();
