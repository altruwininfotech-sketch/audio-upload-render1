/*****************************************************************
 * AUTH CHECK
 *****************************************************************/
const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "/login.html";
}

/*****************************************************************
 * DOM REFERENCES
 *****************************************************************/
const tableBody = document.getElementById("audioTableBody");

/*****************************************************************
 * LOAD AUDIOS
 *****************************************************************/
async function loadAudios() {
  tableBody.innerHTML = "";

  try {
    const res = await fetch("/api/audios", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const files = await res.json();

    if (!Array.isArray(files)) {
      alert(files.error || "Failed to load recordings");
      return;
    }

    if (files.length === 0) {
      tableBody.innerHTML =
        "<tr><td colspan='4'>No recordings found</td></tr>";
      return;
    }

    files.forEach(file => {
      const tr = document.createElement("tr");

      /* ===== FILE NAME ===== */
      const filename = file.key.split("/").pop();

      /* ===== DATE FROM FILENAME (YYYY-MM-DD) ===== */
      let dateText = "N/A";
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) dateText = dateMatch[1];

      /* FILE COLUMN */
      const tdFile = document.createElement("td");
      tdFile.textContent = filename;

      /* DATE COLUMN */
      const tdDate = document.createElement("td");
      tdDate.textContent = dateText;

      /* PLAY COLUMN */
      const tdPlay = document.createElement("td");
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = file.url;
      tdPlay.appendChild(audio);

      /* DOWNLOAD COLUMN */
      const tdDownload = document.createElement("td");
      const link = document.createElement("a");
      link.href = file.url;
      link.download = filename;
      link.textContent = "Download";
      tdDownload.appendChild(link);

      tr.appendChild(tdFile);
      tr.appendChild(tdDate);
      tr.appendChild(tdPlay);
      tr.appendChild(tdDownload);

      tableBody.appendChild(tr);
    });

  } catch (err) {
    console.error("LOAD ERROR:", err);
    alert("Unable to load recordings");
  }
}

/*****************************************************************
 * LOGOUT
 *****************************************************************/
function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login.html";
}

window.loadAudios = loadAudios;
window.logout = logout;