// usage: node in.mjs <urlSubstring> click|dblclick|rclick <x> <y> | type <text> | key <Key> [mods] | drag x1 y1 x2 y2 | move x y | wheel x y dy
const [,, match, action, a, b, c, d] = process.argv;
const targets = await (await fetch("http://127.0.0.1:9471/json/list")).json();
const t = targets.find(t => t.type === "page" && t.url.includes(match));
if (!t) { console.log("NO TARGET"); process.exit(2); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = {};
const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({id, method, params})); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) pending[m.id](m); };
await new Promise(r => ws.onopen = r);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const keymap = {Enter: {code: "Enter", keyCode: 13, text: "\r"}, Escape: {code: "Escape", keyCode: 27}, Backspace: {code: "Backspace", keyCode: 8}, Delete: {code: "Delete", keyCode: 46}, Tab: {code: "Tab", keyCode: 9}, ArrowDown: {code: "ArrowDown", keyCode: 40}, ArrowUp: {code: "ArrowUp", keyCode: 38}};
if (action === "click" || action === "dblclick" || action === "rclick") {
  const x = +a, y = +b, button = action === "rclick" ? "right" : "left";
  await send("Input.dispatchMouseEvent", {type: "mouseMoved", x, y});
  const counts = action === "dblclick" ? [1, 2] : [1];
  for (const clickCount of counts) {
    await send("Input.dispatchMouseEvent", {type: "mousePressed", x, y, button, clickCount, buttons: button === "right" ? 2 : 1});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", x, y, button, clickCount});
  }
} else if (action === "move") {
  await send("Input.dispatchMouseEvent", {type: "mouseMoved", x: +a, y: +b});
} else if (action === "drag") {
  const [x1, y1, x2, y2] = [+a, +b, +c, +d];
  await send("Input.dispatchMouseEvent", {type: "mouseMoved", x: x1, y: y1});
  await send("Input.dispatchMouseEvent", {type: "mousePressed", x: x1, y: y1, button: "left", clickCount: 1, buttons: 1});
  for (let i = 1; i <= 15; i++) { await send("Input.dispatchMouseEvent", {type: "mouseMoved", x: x1 + (x2 - x1) * i / 15, y: y1 + (y2 - y1) * i / 15, button: "left", buttons: 1}); await sleep(15); }
  await send("Input.dispatchMouseEvent", {type: "mouseReleased", x: x2, y: y2, button: "left", clickCount: 1});
} else if (action === "wheel") {
  await send("Input.dispatchMouseEvent", {type: "mouseWheel", x: +a, y: +b, deltaX: 0, deltaY: +c});
} else if (action === "type") {
  for (const ch of a) {
    await send("Input.dispatchKeyEvent", {type: "keyDown", text: ch, key: ch});
    await send("Input.dispatchKeyEvent", {type: "keyUp", key: ch});
  }
} else if (action === "key") {
  const k = keymap[a] || {code: "Key" + a.toUpperCase(), keyCode: a.toUpperCase().charCodeAt(0)};
  const mods = +(b || 0); // 1 alt 2 ctrl 4 meta 8 shift
  await send("Input.dispatchKeyEvent", {type: "rawKeyDown", key: a, code: k.code, windowsVirtualKeyCode: k.keyCode, modifiers: mods});
  if (k.text) await send("Input.dispatchKeyEvent", {type: "char", text: k.text, key: a, modifiers: mods});
  await send("Input.dispatchKeyEvent", {type: "keyUp", key: a, code: k.code, windowsVirtualKeyCode: k.keyCode, modifiers: mods});
}
ws.close();
