export function isAuthHttp(req, res, next) {
  if (req.headers.authorization) {
    req.user = req.headers.authorization;
    next();
  } else res.send("No auth");
}

export function isAuth(req, ws) {
  if (req.headers["sec-websocket-protocol"] === "") {
    ws.send("you are no authenticated");
    return false;
  } else {
    req.user = req.headers["sec-websocket-protocol"];
    return true;
  }
}
