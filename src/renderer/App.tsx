import React from "react";
import { AppShell } from "./components/layout/AppShell";
import { ToastContainer } from "./components/layout/ToastContainer";

export const App: React.FC = () => {
  return (
    <>
      <AppShell />
      <ToastContainer />
    </>
  );
};
