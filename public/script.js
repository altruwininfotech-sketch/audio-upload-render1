async function loadAudios() {
  const res = await fetch("/api/audios");
  const audios = await res.json();

  const table = document.getElementById("audioTable");
  table.innerHTML = "";

  audios.forEach(audio => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${audio.name}</td>
      <td>${new Date(audio.date).toLocaleString()}</td>
      <td>
        <audio controls src="${audio.url}"></audio>
      </td>
      <td>
        <a href="${audio.url}" download>⬇️ Download</a>
      </td>
    `;

    table.appendChild(row);
  });
}

loadAudios();

