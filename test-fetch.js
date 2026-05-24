async function run() {
  const r = await fetch("http://127.0.0.1:3000/api/debug-users");
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2));
}
run();
