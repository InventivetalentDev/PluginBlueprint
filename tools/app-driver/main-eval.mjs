// usage: node main-eval.mjs <expression>   (evaluates in the Electron main process via --inspect=9271)
const [,, expr] = process.argv;
const targets = await (await fetch("http://127.0.0.1:9271/json/list")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
let id = 0; const pending = {};
const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({id, method, params})); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) pending[m.id](m); };
await new Promise(r => ws.onopen = r);
const res = await send("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true});
console.log(JSON.stringify(res.result.exceptionDetails ? res.result.exceptionDetails.exception?.description || res.result.exceptionDetails : res.result.result.value, null, 1));
ws.close();
