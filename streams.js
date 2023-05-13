import Redis from "ioredis";
const redis = new Redis();
const sub = new Redis();
const pub = new Redis();

// Usage 1: As message hub
const processMessage = (message) => {
  console.log("Id: %s. Data: %O", message[0], message[1]);
};

async function listenForMessage(lastId = "$") {
  // `results` is an array, each element of which corresponds to a key.
  // Because we only listen to one key (mystream) here, `results` only contains
  // a single element. See more: https://redis.io/commands/xread#return-value
  const results = await sub.xread("BLOCK", 0, "STREAMS", "user-stream", lastId);
  const [key, messages] = results[0]; // `key` equals to "user-stream"

  messages.forEach(processMessage);
  // Pass the last id of the results to the next round.
  await listenForMessage(messages[messages.length - 1][0]);
}

// listenForMessage();

// setInterval(() => {
//   // `redis` is in the block mode due to `redis.xread('BLOCK', ....)`,
//   // so we use another connection to publish messages.
//   pub.xadd("user-stream", "*", "name", "John", "age", "20");
// }, 1000);

async function XREADGROUP(group, stream, user, count = 1000) {
  return await redis.xreadgroup(
    "GROUP",
    group,
    user,
    "COUNT",
    count,
    "STREAMS",
    stream,
    ">"
  );
}
// Usage 2: As a list
async function main() {
  let lastRecordId = "$";

  let stream = "m_stream";
  let group = "m_group";
  //init
  // redis
  //   .pipeline()
  //   .xadd(stream, "*", "message", "item1")
  //   .xadd(stream, "*", "message", "item2")
  //   .xadd(stream, "*", "message", "item3") //JSON.stringify({emitter: "cow", message:"hi humans"})
  //   .xadd(stream, "*", "message", "to ack")
  //   .exec();
  try {
    await redis.xgroup("CREATE", stream, group, lastRecordId, "MKSTREAM");
  } catch (error) {
    console.log("error", error);
  }

  //put
  console.log("here");
  //read
  const [[, res]] = await XREADGROUP(group, stream, "PICHICHI", 2);
  const [[, res2]] = await XREADGROUP(group, stream, "BOB", 2);
  const [[, res3]] = await XREADGROUP(group, stream, "BOB");
  const [[, res4]] = await XREADGROUP(group, stream, "jel");

  console.log(res);
  console.log(res2);
  console.log(res3);
  console.log(res4);
  //   const items = await redis.xrange("message-stream", "-", "+", "COUNT", 3);
  //   console.log(items);

  //   let inf = await redis.xinfo("GROUPS", "message-group");
  //   console.log(inf);
  //   if (!inf) {
  // redis.xgroup("CREATE", "message-stream", "message-group", "$");
  //   }

  // let [[id, data]] = await redis.xreadgroup(
  //   "GROUP",
  //   "message-group",
  //   "Jose",
  //   "COUNT",
  //   3,
  //   "STREAMS",
  //   "message-stream",
  //   ">"
  // );

  // console.log(id, data);
  // [
  //   [ '1647321710097-0', [ 'id', 'item1' ] ],
  //   [ '1647321710098-0', [ 'id', 'item2' ] ]
  // ]
}

main();
