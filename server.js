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

// 起動確認用。Proxy 画面と Apps Script のスリープ防止が叩く。
// CORS を許可しているので、ブラウザから「ok」が読めれば「本物のサーバーが起きている」と分かる。
// （眠っている間に Render が返す待機ページには、このヘッダーが付かない）
app.get("/ping", (req, res) => {
    res.set({ "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
    res.type("text/plain").send("ok");
});

// index.html, sw.js, controller/, scramjet/ をプロジェクト直下から配信
app.use(express.static("./"));

const httpServer = createServer(app);

// /wisp/ への WebSocket 接続を wisp サーバーに渡す。
// wisp-js は URL が「/」で終わらないと、? 以降を接続先ホスト名（wsproxy 形式）と解釈して
// 接続を閉じてしまう。index.html が付ける ?t=... があってもこうならないよう、パスを正規化する。
httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url.startsWith("/wisp/")) {
        socket.destroy();
        return;
    }
    req.url = "/wisp/";
    wisp.routeRequest(req, socket, head);
});

httpServer.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
