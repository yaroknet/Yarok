import { Navigate } from "react-router-dom";

// מחירון השירותים הועבר להיות טאב פנימי בעמוד הצעות מחיר
export default function AdminPriceList() {
  return <Navigate to="/admin/quotes" replace />;
}
