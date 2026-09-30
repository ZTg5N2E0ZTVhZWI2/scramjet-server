import express from "express";
import { createServer } from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const app = express();
const port = process.env.PORT || 3000;

// 認証なし版: Apps Script のトークン検証は行わない。
// そのため GAS_VALIDATE_URL / GAS_API_SECRET の環境変数は不要（残っていても使われない）。

// 悪用対策。wisp-js 0.4.x の既定値でも false だが、明示しておく。
wisp.options.allow_private_ips = false;   // 10.x / 172.16-31.x / 192.168.x など
wisp.options.allow_loopback_ips = false;  // 127.x / localhost
wisp.options.port_blacklist = [25];       // SMTP（迷惑メール送信の踏み台にされないように）

// index.html, sw.js, controller/, scramjet/ をプロジェクト直下から配信
app.use(express.static("./"));

const httpServer = createServer(app);

// /wisp/ への WebSocket 接続をそのまま wisp サーバーに渡す
httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url.startsWith("/wisp/")) {
        socket.destroy();
        return;
    }
    wisp.routeRequest(req, socket, head);
});

httpServer.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
