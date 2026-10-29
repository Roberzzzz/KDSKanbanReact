let id = null;

self.onmessage = (e) => {
  if (e.data === "start" && id === null) {
    id = setInterval(() => self.postMessage(Date.now()), 1000);
  }
  if (e.data === "stop" && id !== null) {
    clearInterval(id);
    id = null;
  }
};
