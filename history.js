import { createServer } from "http";
import { Redis } from "ioredis";
import { WebSocketServer } from "ws";
import level from "level";
import JSONStream from "JSONStream";
import { PassThrough, Transform } from "stream";

const redisClient = new Redis();
const redisClientXRead = new Redis();
const db = level("./chat");

async function main() {
  const logs = await redisClient.xrange("chat_stream", "-", "+");
  // for await (const [key, value] of db.iterator()) {
  //   console.log(key, value);
  // }

  createServer(async (req, res) => {
    res.writeHead(200);
    // res.write(JSON.stringify({ data: "some" }));
    db.createValueStream().pipe(JSONStream.stringify()).pipe(res);
    res.end();
  }).listen(8090);
}
let lastRecordId = "$";

async function processQueue() {
  while (true) {
    const [[, records]] = await redisClientXRead.xread(
      "BLOCK",
      "0",
      "STREAMS",
      "chat_stream",
      lastRecordId
    );
    console.log({ records }, "new record!");
    for (const [recordId, [, message]] of records) {
      console.log(`Message from stream: ${message}`);
      // broadcast(message);
      console.log({ message, recordId });
      await db.put(recordId, message);
      lastRecordId = recordId;
    }
  }
}
processQueue().catch((err) => console.log(err));
main().catch((err) => console.log(err));
