// src/routes/AppRoutes.jsx
import { Suspense } from "react";
import { useRoutes } from "react-router-dom";
import IsLoading from "../components/isLoading";
import { routes } from "./routes";

export default function AppRoutes() {
  const element = useRoutes(routes);
  return <Suspense fallback={<IsLoading />}>{element}</Suspense>;
}
