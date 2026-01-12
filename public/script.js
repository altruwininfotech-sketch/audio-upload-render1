async function loadAudios() {
  const res = await fetch("/api/audios");
  if (!res.ok) {
    alert("Not authorized");
    return;
  }

  const data = await res.json();
  const tbody = document.getElementById("audioTableBody");
  tbody.innerHTML = "";

  data.forEach(file => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${file.key}</td>
      <td><audio controls src="${file.url}"></audio></td>
      <td><a href="${file.url}" download>Download</a></td>
    `;

    tbody.appendChild(tr);
  });
}

