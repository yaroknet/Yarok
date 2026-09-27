import { FleetDriveDocuments } from "./FleetDriveDocuments";

export function DocumentsScreen() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">מסמכים</h2>
      <FleetDriveDocuments />
    </div>
  );
}
