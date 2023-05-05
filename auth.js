export function isAuth(req, ws) {
  console.log(typeof req.headers["sec-websocket-protocol"]);
  if (req.headers["sec-websocket-protocol"] === "1") {
    ws.send("you are no authenticated");
    return false;
  } else {
    req.user = req.headers["sec-websocket-protocol"];
    return true;
  }
}
