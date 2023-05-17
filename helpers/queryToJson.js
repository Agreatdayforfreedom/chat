export function format(query) {
  if (Array.isArray(query)) {
    let arr = [];
    for (const record of query) {
      const result = _do(record);
      arr.push(result);
    }
    return arr;
  } else {
    return _do(query);
  }
}

function _do(record) {
  let obj = {};
  let key;
  let value; //ID
  for (const element in record) {
    if (element === "id" && !obj["id"]) {
      obj["id"] = record[element];
      continue;
    }
    if (element.includes("foreign")) {
      key = element.split("foreign")[0];
      value = record[element];
      continue;
    }

    if (key) {
      let format = element.split("_");
      if (!obj[key]) obj[key] = {};
      if (!obj[key]["id"]) obj[key]["id"] = value;
      if (obj[key]) obj[key][format[format.length - 1]] = record[element];
    }
  }
  return obj;
}
