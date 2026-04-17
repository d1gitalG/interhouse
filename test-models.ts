const apiKey = "AIzaSyBgpNRVMklNxqLKRsQZcAV0NviqOjSIW6g";
const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash-exp"];

async function test() {
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
    });
    console.log(`${model}: ${resp.status} ${resp.statusText}`);
    if (!resp.ok) console.log(await resp.text());
  }
}

test();
