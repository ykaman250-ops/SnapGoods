fetch("http://localhost:3000/api/create-organization", { method: "POST", headers: {"Content-Type": "application/json"}, body: "{}" }).then(r => r.json()).then(console.log).catch(console.error);
