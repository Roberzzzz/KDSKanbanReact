import { createContext, useContext, useEffect, useState } from "react";

const NowContext = createContext(Date.now());

export function NowProvider({ children }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let worker;
    let respaldo;

    try {
      worker = new Worker(new URL("./timerWorker.js", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) => setNow(e.data);
      worker.onerror = () => {
        worker.terminate();
        respaldo = setInterval(() => setNow(Date.now()), 1000);
      };
      worker.postMessage("start");
    } catch {
      respaldo = setInterval(() => setNow(Date.now()), 1000);
    }

    return () => {
      worker?.terminate();
      clearInterval(respaldo);
    };
  }, []);

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export const useNow = () => useContext(NowContext);
