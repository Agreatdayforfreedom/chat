export function isAuthHttp(req, res, next) {
  console.log(req.body, "HE");
  if (req.headers.authorization) {
    req.user = req.headers.authorization;
    next();
  } else res.send("No auth");
}

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
