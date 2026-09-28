import express from "express";
import { createServer } from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const app = express();
const port = process.env.PORT || 3000;

// GAS(Proxy)側の Web アプリ URL と、その code.js の CONFIG.API_SECRET と同じ値。
// どちらも Render の環境変数（Dashboard > Environment）で設定すること。
// ここにベタ書きしない: server.js はリポジトリに入るため、書くと外部に漏れる。
const GAS_VALIDATE_URL = process.env.GAS_VALIDATE_URL; // 例: https://script.google.com/macros/s/xxxxx/exec
const GAS_API_SECRET = process.env.GAS_API_SECRET;
const VALIDATE_TIMEOUT_MS = 5000;

// Serve your existing files (index.html, sw.js, controller/, scramjet/)
// from the project root, exactly like Render's static hosting did.
app.use(express.static("./"));

const httpServer = createServer(app);

// GAS に「このトークンは今も有効なセッションか」を問い合わせる（サーバー間通信）。
// この通信はブラウザを経由しないので、拡張機能などから中身は見えない。
async function isTokenValid(token) {
    if (!token || !GAS_VALIDATE_URL || !GAS_API_SECRET) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);

    try {
        const url = new URL(GAS_VALIDATE_URL);
        url.searchParams.set("validate", token);
        url.searchParams.set("secret", GAS_API_SECRET);

        const res = await fetch(url, { method: "GET", signal: controller.signal });
        if (!res.ok) return false;

        const data = await res.json();
        return data.valid === true;
    } catch (e) {
        console.error("GAS session validation failed:", e.message || e);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

// Route WebSocket upgrade requests under /wisp/ to the wisp server,
// but only after confirming the caller has a currently-valid GAS session.
// Everything else (normal HTTP requests) still goes to express/static above.
httpServer.on("upgrade", async (req, socket, head) => {
    if (!req.url.startsWith("/wisp/")) {
        socket.destroy();
        return;
    }

    const token = new URL(req.url, "http://localhost").searchParams.get("t");
    const valid = await isTokenValid(token);
    if (!valid) {
        socket.destroy();
        return;
    }

    wisp.routeRequest(req, socket, head);
});

httpServer.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
