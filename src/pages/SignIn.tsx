import { Navigate } from "react-router-dom";

export default function SignIn() {
  return (
    <Navigate
      to="/login"
      replace
    />
  );
}