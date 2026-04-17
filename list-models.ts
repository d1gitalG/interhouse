const apiKey = "AIzaSyBgpNRVMklNxqLKRsQZcAV0NviqOjSIW6g";

async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const resp = await fetch(url);
  console.log(`${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
