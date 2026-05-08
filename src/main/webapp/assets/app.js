// app.js
(() => {
    const $ = (id) => document.getElementById(id);

    const apiBaseEl = $("apiBase");
    const apiKeyEl = $("apiKey");
    const modelEl = $("model");
    const customModelEl = $("customModel");
    const modeEl = $("mode");
    const promptEl = $("prompt");
    const sizeEl = $("size");
    const qualityEl = $("quality");
    const styleEl = $("style");
    const responseFormatEl = $("responseFormat");
    const imageCountEl = $("imageCount");
    const imageFileEl = $("imageFile");

    const generateBtn = $("generateBtn");
    const cancelBtn = $("cancelBtn");
    const saveApiBtn = $("saveApiBtn");
    const statusEl = $("status");
    const errorEl = $("error");
    const sourcePreviewListEl = $("sourcePreviewList");
    const resultImgEl = $("resultImg");
    const resultListEl = $("resultList");
    const rawOutputEl = $("rawOutput");
    const customSizeWrapEl = $("customSizeWrap");
    const customWidthEl = $("customWidth");
    const customHeightEl = $("customHeight");
    const noticeMaskEl = $("noticeMask");
    const noticeContentEl = $("noticeContent");
    const noticeCloseBtnEl = $("noticeCloseBtn");
    const API_STORAGE_KEY = "openai-image-local-api-v1";
    const DEFAULT_IMAGE_MODEL = "gpt-image-2";

    const requiredIds = [
        "apiBase", "apiKey", "model", "customModel", "mode", "prompt", "size", "quality", "style", "responseFormat", "imageCount", "imageFile",
        "generateBtn", "cancelBtn", "saveApiBtn", "status", "error", "sourcePreviewList", "resultImg", "rawOutput",
        "customSizeWrap", "customWidth", "customHeight", "resultList",
        "noticeMask", "noticeContent", "noticeCloseBtn"
    ];
    const missing = requiredIds.filter(id => !$(id));
    if (missing.length) {
        console.error("缺少页面元素 ID:", missing.join(", "));
        return;
    }

    function setStatus(msg = "") { statusEl.textContent = msg; }
    function setError(msg = "") { errorEl.textContent = msg; }
    function setRaw(objOrText = "") {
        rawOutputEl.textContent =
            typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText, null, 2);
    }
    function setGenerating(generating) {
        generateBtn.disabled = !!generating;
        cancelBtn.disabled = !generating;
    }
    function resetImage() {
        resultImgEl.src = "";
        resultImgEl.style.display = "none";
        resultListEl.innerHTML = "";
    }
    function resetSourcePreview() {
        sourcePreviewListEl.innerHTML = "";
    }
    function showSourcePreview(items) {
        resetSourcePreview();
        for (const it of items) {
            const card = document.createElement("div");
            card.className = "preview-item";

            const img = document.createElement("img");
            img.src = it.src;
            img.alt = it.name || "参考图";

            const cap = document.createElement("div");
            cap.className = "cap";
            cap.title = it.name || "";
            cap.textContent = `${it.index}. ${it.name || "image"}`;

            card.appendChild(img);
            card.appendChild(cap);
            sourcePreviewListEl.appendChild(card);
        }
    }
    function showImage(src) {
        resultImgEl.src = src;
        resultImgEl.style.display = "block";
    }
    function renderResultList(images) {
        resultListEl.innerHTML = "";
        images.forEach((src, idx) => {
            const card = document.createElement("div");
            card.className = "result-item";
            if (idx === 0) card.classList.add("active");

            const img = document.createElement("img");
            img.src = src;
            img.alt = `结果图 ${idx + 1}`;
            img.title = `点击查看第 ${idx + 1} 张`;

            const selectThisImage = () => {
                showImage(src);
                const items = resultListEl.querySelectorAll(".result-item");
                items.forEach((it, i) => it.classList.toggle("active", i === idx));
                setStatus(`正在查看第 ${idx + 1} 张。`);
            };
            card.addEventListener("click", selectThisImage);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = `下载第 ${idx + 1} 张`;
            btn.addEventListener("click", async (e) => {
                // Prevent card click from firing when pressing download.
                e?.stopPropagation?.();
                setError("");
                try {
                    const ext = guessExtFromImageSrc(src);
                    const fileName = `generated-${idx + 1}-${Date.now()}.${ext}`;
                    if (window.electronAPI?.downloadImage) {
                        const ret = await window.electronAPI.downloadImage(src, fileName);
                        if (!ret?.ok) throw new Error(ret?.error || "下载失败");
                    } else {
                        await downloadInBrowser(src, fileName);
                    }
                    setStatus(`第 ${idx + 1} 张下载成功。`);
                } catch (e) {
                    setError(`下载失败：${e?.message || String(e)}`);
                }
            });

            card.appendChild(img);
            card.appendChild(btn);
            resultListEl.appendChild(card);
        });
    }

    function isImageToImageMode(mode) {
        return mode === "edit" || mode === "variation";
    }
    function buildEndpoint(apiBase, mode) {
        if (mode === "edit") return `${apiBase}/v1/images/edits`;
        if (mode === "variation") return `${apiBase}/v1/images/variations`;
        return `${apiBase}/v1/images/generations`;
    }
    function getImageFiles() {
        const files = imageFileEl.files ? Array.from(imageFileEl.files) : [];
        return files;
    }
    function validateImageFiles(files, mode) {
        if (!files.length) return "请上传参考图";
        if (mode === "variation" && files.length !== 1) return "参考图变体模式仅支持 1 张图片";
        if (mode === "edit" && files.length > 16) return "图像编辑模式最多支持 16 张图片";
        for (const file of files) {
            const okType = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
            if (!okType) return "仅支持 PNG/JPEG/WEBP 图片";
        }
        return "";
    }
    function readAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
            reader.readAsDataURL(file);
        });
    }

    function normalizeBase(url) {
        return (url || "").trim().replace(/\/+$/, "");
    }
    function getResolvedModel() {
        const custom = String(customModelEl.value || "").trim();
        if (custom) return custom;
        const selectedValue = String(modelEl.value || "").trim();
        if (selectedValue) return selectedValue;
        const selected = modelEl.options && modelEl.selectedIndex >= 0
            ? modelEl.options[modelEl.selectedIndex]
            : null;
        const optionText = String(selected?.value || selected?.text || "").trim();
        return optionText;
    }
    function getModelForMode(rawModel, mode) {
        let model = String(rawModel || "").trim();
        if (!model) model = DEFAULT_IMAGE_MODEL;
        // Many compatible gateways only accept dall-e-2 for variations.
        if (mode === "variation" && model === "dall-e-3") {
            model = "dall-e-2";
        }
        return model;
    }
    function toPositiveInt(v) {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) return 0;
        return n;
    }
    function getResolvedImageCount() {
        const n = toPositiveInt(imageCountEl.value);
        if (!n) return { error: "生成数量必须是正整数" };
        if (n > 10) return { error: "生成数量不能超过 10" };
        return n;
    }
    function validateImageCountForModel(mode, model, imageCount) {
        // OpenAI-compatible behavior: dall-e-3 generation often only supports n=1.
        if (mode === "generation" && model === "dall-e-3" && imageCount > 1) {
            return "dall-e-3 通常仅支持一次 1 张图。请改用 dall-e-2 / gpt-image-2，或把生成数量改为 1。";
        }
        return "";
    }
    function toggleCustomSizeInput() {
        const useCustom = sizeEl.value === "custom";
        customSizeWrapEl.classList.toggle("show", useCustom);
    }
    function getResolvedSize() {
        if (sizeEl.value !== "custom") return sizeEl.value.trim();
        const w = toPositiveInt(customWidthEl.value);
        const h = toPositiveInt(customHeightEl.value);
        if (!w || !h) return { error: "请输入有效的自定义分辨率（宽和高都必须是正整数）" };
        if (w < 64 || h < 64 || w > 4096 || h > 4096) {
            return { error: "自定义分辨率范围需在 64 ~ 4096 之间" };
        }
        return `${w}x${h}`;
    }
    function saveApiConfig() {
        const payload = {
            apiBase: normalizeBase(apiBaseEl.value),
            apiKey: apiKeyEl.value.trim()
        };
        localStorage.setItem(API_STORAGE_KEY, JSON.stringify(payload));
    }
    function loadApiConfig() {
        try {
            const raw = localStorage.getItem(API_STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data && typeof data === "object") {
                if (typeof data.apiBase === "string" && data.apiBase.trim()) {
                    apiBaseEl.value = data.apiBase.trim();
                }
                if (typeof data.apiKey === "string" && data.apiKey.trim()) {
                    apiKeyEl.value = data.apiKey.trim();
                }
            }
        } catch (_) {
            localStorage.removeItem(API_STORAGE_KEY);
        }
    }

    function guessExtFromImageSrc(src) {
        if (!src) return "png";
        if (src.startsWith("data:image/jpeg")) return "jpg";
        if (src.startsWith("data:image/webp")) return "webp";
        try {
            const u = new URL(src);
            const p = u.pathname.toLowerCase();
            if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "jpg";
            if (p.endsWith(".webp")) return "webp";
            if (p.endsWith(".png")) return "png";
        } catch (_) {}
        return "png";
    }

    async function downloadInBrowser(src, fileName) {
        if (src.startsWith("data:")) {
            const a = document.createElement("a");
            a.href = src;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }

        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`下载失败: HTTP ${resp.status}`);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        try {
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    function showNotice(content) {
        noticeContentEl.textContent = content || "暂无公告";
        noticeMaskEl.classList.add("show");
    }

    async function loadAnnouncement() {
        if (window.location.protocol === "file:") {
            const localNotice = window.__APP_ANNOUNCEMENT__;
            if (localNotice && String(localNotice).trim()) {
                showNotice(localNotice);
                return;
            }
            window.addEventListener("app-announcement-ready", () => {
                const delayedNotice = window.__APP_ANNOUNCEMENT__;
                showNotice((delayedNotice && String(delayedNotice).trim()) ? delayedNotice : "暂无公告");
            }, { once: true });
            return;
        }

        const path = window.location.pathname || "/";
        const contextPath = path.endsWith("/")
            ? path.slice(0, -1)
            : path.replace(/\/[^/]*$/, "");
        const candidateUrls = [
            `${contextPath}/api/announcement`,
            "api/announcement",
            "/api/announcement"
        ];

        let lastError = null;
        try {
            for (const url of candidateUrls) {
                const resp = await fetch(url, { method: "GET" });
                const text = await resp.text();
                let data = null;
                try { data = JSON.parse(text); } catch (_) {}

                if (!resp.ok) {
                    lastError = new Error(text || `HTTP ${resp.status}`);
                    continue;
                }
                showNotice(data?.content || "暂无公告");
                return;
            }
            throw lastError || new Error("公告接口不可用");
        } catch (err) {
            showNotice("公告读取失败，请稍后重试。\n\n" + (err?.message || String(err)));
        }
    }
    noticeCloseBtnEl.addEventListener("click", () => noticeMaskEl.classList.remove("show"));
    sizeEl.addEventListener("change", toggleCustomSizeInput);

    saveApiBtn.addEventListener("click", () => {
        setError("");
        try {
            saveApiConfig();
            setStatus("API Base 与 API Key 已保存到本地。");
        } catch (e) {
            setError(`本地API保存失败：${e?.message || String(e)}`);
        }
    });

    modeEl.addEventListener("change", () => {
        const mode = modeEl.value;
        const needsImage = isImageToImageMode(mode);
        imageFileEl.disabled = !needsImage;
        imageFileEl.multiple = mode === "edit";
        if (!needsImage) {
            imageFileEl.value = "";
            resetSourcePreview();
        }
    });

    let requestController = null;
    cancelBtn.addEventListener("click", () => {
        if (!requestController) return;
        requestController.abort();
        requestController = null;
        setStatus("已取消当前请求。");
        setGenerating(false);
    });

    imageFileEl.addEventListener("change", async () => {
        setError("");
        const mode = modeEl.value.trim() || "generation";
        const files = getImageFiles();
        if (!files.length) {
            resetSourcePreview();
            return;
        }
        const err = validateImageFiles(files, mode);
        if (err) {
            imageFileEl.value = "";
            resetSourcePreview();
            setError(err);
            return;
        }
        try {
            const previews = await Promise.all(
                files.map(async (f, idx) => ({
                    src: await readAsDataUrl(f),
                    name: f.name,
                    index: idx + 1
                }))
            );
            showSourcePreview(previews);
        } catch (e) {
            imageFileEl.value = "";
            resetSourcePreview();
            setError(`参考图预览失败：${e?.message || String(e)}`);
        }
    });

    generateBtn.addEventListener("click", async () => {
        setError("");
        setStatus("");
        setRaw("");
        resetImage();

        const apiBase = normalizeBase(apiBaseEl.value);
        const apiKey = apiKeyEl.value.trim();
        const model = getModelForMode(getResolvedModel(), modeEl.value.trim() || "generation");
        const mode = modeEl.value.trim() || "generation";
        const prompt = promptEl.value.trim();
        const size = getResolvedSize();
        const quality = qualityEl.value.trim();
        const style = styleEl.value.trim();
        const response_format = responseFormatEl.value.trim();
        const imageCount = getResolvedImageCount();
        const imageFiles = getImageFiles();

        if (!apiBase) return setError("请输入 API Base，例如 https://api.openai.com");
        if (!apiKey) return setError("请输入 API Key");
        if (!model) return setError("模型不能为空，请重新选择或填写自定义模型名");
        if (!prompt && mode !== "variation") return setError("请输入提示词 Prompt");
        if (typeof imageCount === "object" && imageCount?.error) return setError(imageCount.error);
        const countModelErr = validateImageCountForModel(mode, model, imageCount);
        if (countModelErr) return setError(countModelErr);

        if (typeof size === "object" && size?.error) return setError(size.error);

        if (isImageToImageMode(mode)) {
            const fileErr = validateImageFiles(imageFiles, mode);
            if (fileErr) return setError(fileErr);
        }

        const url = buildEndpoint(apiBase, mode);

        requestController = new AbortController();
        setGenerating(true);
        setStatus(mode === "generation" ? "正在生成图片..." : `正在处理图片（${imageFiles.length || 1} 张）...`);

        try {
            const sendOnce = async (requestedN) => {
                let resp;
                let requestDebug = null;
                if (mode === "generation") {
                    const body = { prompt };
                    body.model = model;
                    if (size) body.size = size;
                    if (quality) body.quality = quality;
                    if (style && model === "dall-e-3") body.style = style;
                    if (response_format) body.response_format = response_format;
                    if (requestedN > 1) body.n = requestedN;

                    requestDebug = {
                        mode,
                        url,
                        model: body.model,
                        size: body.size || "",
                        quality: body.quality || "",
                        style: body.style || "",
                        response_format: body.response_format || "",
                        n: body.n || 1
                    };

                    resp = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(body),
                        signal: requestController.signal
                    });
                } else {
                    const form = new FormData();
                    for (const file of imageFiles) {
                        form.append("image", file);
                    }
                    form.append("model", String(model));
                    if (prompt) form.append("prompt", prompt);
                    if (size) form.append("size", size);
                    if (quality) form.append("quality", quality);
                    if (response_format) form.append("response_format", response_format);
                    if (requestedN > 1) form.append("n", String(requestedN));

                    requestDebug = {
                        mode,
                        url,
                        model,
                        image_count: imageFiles.length,
                        image_names: imageFiles.map(f => f.name),
                        size: size || "",
                        quality: quality || "",
                        response_format: response_format || "",
                        n: requestedN
                    };

                    resp = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`
                        },
                        body: form,
                        signal: requestController.signal
                    });
                }

                const text = await resp.text();
                let data = null;
                try { data = JSON.parse(text); } catch (_) {}

                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status} - ${text}`);
                }

                const items = Array.isArray(data?.data) ? data.data : [];
                const urls = [];
                for (const item of items) {
                    if (item?.url) urls.push(item.url);
                    else if (item?.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`);
                }
                return { requestDebug, raw: data || text, urls };
            };

            const rounds = [];
            const firstRound = await sendOnce(imageCount);
            rounds.push(firstRound);
            const imageSrcList = [...firstRound.urls];

            // Compatibility fallback: some gateways ignore "n" for edit/variation and always return 1 image.
            if (isImageToImageMode(mode) && imageCount > imageSrcList.length) {
                let remain = imageCount - imageSrcList.length;
                while (remain > 0) {
                    const oneRound = await sendOnce(1);
                    rounds.push(oneRound);
                    if (!oneRound.urls.length) break;
                    imageSrcList.push(...oneRound.urls.slice(0, remain));
                    remain = imageCount - imageSrcList.length;
                }
            }

            setRaw({
                debug_requests: rounds.map(r => r.requestDebug),
                requested_count: imageCount,
                returned_count: imageSrcList.length,
                responses: rounds.map(r => r.raw)
            });

            if (!imageSrcList.length) {
                throw new Error("返回中没有可展示的 url 或 b64_json");
            }
            showImage(imageSrcList[0]);
            renderResultList(imageSrcList);
            if (imageCount > imageSrcList.length) {
                setStatus(`图片已生成，但仅返回 ${imageSrcList.length}/${imageCount} 张（模型或网关可能不支持多图）。`);
            } else {
                setStatus(`图片生成成功，共 ${imageSrcList.length} 张。`);
            }
        } catch (err) {
            console.error(err);
            if (err?.name === "AbortError") {
                setError("请求已取消。");
                setStatus("已取消当前请求。");
            } else if (String(err.message).includes("Failed to fetch")) {
                setError("Failed to fetch：通常是 CORS 或网络问题，必要时请改为后端代理。");
            } else {
                setError(`生成失败：${err.message}`);
            }
            if (err?.name !== "AbortError") setStatus("");
        } finally {
            requestController = null;
            setGenerating(false);
        }
    });

    modeEl.dispatchEvent(new Event("change"));
    toggleCustomSizeInput();
    loadApiConfig();
    loadAnnouncement();
})();
