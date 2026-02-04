"use client";
// biome-ignore assist/source/organizeImports: react-scan
import { scan } from "react-scan";
import { useEffect } from "react";

export function ReactScan() {
  useEffect(() => {
    scan({
      enabled: process.env.NODE_ENV === "development",
      dangerouslyForceRunInProduction: process.env.NODE_ENV === "development",
    });
  }, []);

  return null;
}
