const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

async function loadAudios() {
  const res = await fetch("/api/audios", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return alert("Unable to load recordings");

  const data = await res.json();

  const agentSet = new Set();
  data.forEach(a => agentSet.add(a.agent));

  agentFilter.innerHTML = `<option value="">All Agents</option>`;
  agentSet.forEach(a => {
    agentFilter.innerHTML += `<option>${a}</option>`;
  });

  renderTable(data);
}

function renderTable(data) {
  audioTableBody.innerHTML = "";

  const agent = agentFilter.value;
  const date = dateFilter.value;

  data
    .filter(a => !agent || a.agent === agent)
    .filter(a => !date || a.date.startsWith(date))
    .forEach(a => {
      audioTableBody.innerHTML += `
        <tr>
          <td>${a.name}</td>
          <td>${new Date(a.date).toLocaleString()}</td>
          <td><audio controls src="${a.url}"></audio></td>
          <td><a href="${a.url}" download>Download</a></td>
        </tr>`;
    });
}

loadAudios();

