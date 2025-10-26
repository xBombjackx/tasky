// config.js
window.Twitch.ext.onAuthorized(function (auth) {
  fetchConfiguration(auth.token);
});

function fetchConfiguration(token) {
  const url = `http://localhost:8081/config`;
  fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data) {
        document.getElementById("streamerDbId").value = data.streamerDbId;
        document.getElementById("viewerDbId").value = data.viewerDbId;
      }
    });
}

function saveConfiguration() {
  const streamerDbId = document.getElementById("streamerDbId").value;
  const viewerDbId = document.getElementById("viewerDbId").value;

  window.Twitch.ext.configuration.set(
    "broadcaster",
    "1",
    JSON.stringify({
      streamerDbId: streamerDbId,
      viewerDbId: viewerDbId,
    })
  );
}
