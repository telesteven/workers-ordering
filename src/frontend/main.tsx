import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import OrderPage from "./order/OrderPage";
import ChefPage from "./chef/ChefPage";
import ManagerPage from "./manager/ManagerPage";
import HomePage from "./HomePage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/order/:tableNumber" element={<OrderPage />} />
        <Route path="/chef" element={<ChefPage />} />
        <Route path="/manager" element={<ManagerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
