"use client";

import * as React from "react";

export const brasiliaToday = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
export function useBrasiliaDate() {
  const [date, setDate] = React.useState(brasiliaToday);
  React.useEffect(() => {
    // Align to the next minute (including midnight), and recover after suspended tabs.
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      setDate(brasiliaToday());
      timer = window.setTimeout(update, 60000 - (Date.now() % 60000) + 1);
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return date;
}
