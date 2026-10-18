// usage: node cdp.mjs <urlSubstring> <expression> [screenshot.png]
const [,, match, expr, shot] = process.argv;
const targets = await (await fetch("http://127.0.0.1:9471/json/list")).json();
const t = targets.find(t => t.type === "page" && t.url.includes(match));
if (!t) { console.log("NO TARGET", targets.map(t => t.url)); process.exit(2); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = {};
const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({id, method, params})); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) pending[m.id](m); };
await new Promise(r => ws.onopen = r);
if (expr && expr !== "-") {
  const res = await send("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true});
  console.log(JSON.stringify(res.result.exceptionDetails ? res.result.exceptionDetails : res.result.result.value, null, 1));
}
if (shot) {
  const clip = process.env.CLIP ? {...JSON.parse(process.env.CLIP), scale: 1} : undefined; const s = await send("Page.captureScreenshot", {format: "png", clip});
  (await import("node:fs")).writeFileSync(shot, Buffer.from(s.result.data, "base64"));
  console.log("saved", shot);
}
ws.close();
