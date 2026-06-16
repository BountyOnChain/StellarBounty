"use client";

import { useEffect } from "react";

export function AxeDevTools() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    void Promise.all([import("@axe-core/react"), import("react"), import("react-dom")]).then(
      ([{ default: axe }, React, ReactDOM]) => {
        axe(React, ReactDOM, 1000);
      },
    );
  }, []);

  return null;
}
