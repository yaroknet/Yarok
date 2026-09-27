import { describe, expect, it } from "vitest";
import { buildSheetMapping, extractImportTask } from "@/employees/lib/taskImport";

describe("task import helpers", () => {
  it("maps Hebrew headers to import fields", () => {
    const mapping = buildSheetMapping([
      "רשת",
      "סניף",
      "גורם מבצע",
      "סוג העבודה",
      "תדירות",
      "צילום חובה",
    ]);

    expect(mapping).toMatchObject({
      network_name: 0,
      branch_name: 1,
      executor: 2,
      work_type: 3,
      frequency: 4,
      requires_photo: 5,
    });
  });

  it("normalizes Castro-style rows where frequency and work type are effectively swapped", () => {
    const mapping = buildSheetMapping([
      "רשת",
      "סניף",
      "גורם מבצע",
      "סוג העבודה",
      "תדירות",
      "צילום חובה",
    ]);

    const task = extractImportTask(
      ["קסטרו", "מלחה נשים ירושלים", "צחי", "חודשי", "יסודי חודשי", "כן"],
      mapping,
      { צחי: "user-1" }
    );

    expect(task).toMatchObject({
      networkName: "קסטרו",
      branchName: "מלחה נשים ירושלים",
      executorName: "צחי",
      assignedTo: "user-1",
      workType: "יסודי חודשי",
      frequency: "monthly",
      requiresPhoto: true,
    });
  });

  it("keeps regular rows intact", () => {
    const mapping = buildSheetMapping([
      "רשת",
      "סניף",
      "גורם מבצע",
      "סוג העבודה",
      "תדירות",
    ]);

    const task = extractImportTask(
      ["סופר פארם", "קריית אונו", "אהרון", "רבעוני", "רבעוני"],
      mapping,
      { אהרון: "user-2" }
    );

    expect(task).toMatchObject({
      networkName: "סופר פארם",
      branchName: "קריית אונו",
      executorName: "אהרון",
      assignedTo: "user-2",
      workType: "רבעוני",
      frequency: "quarterly",
    });
  });

  it("preserves blank sides as 0 instead of forcing 1", () => {
    const mapping = buildSheetMapping([
      "רשת",
      "סניף",
      "גורם מבצע",
      "סוג העבודה",
      "תדירות",
      "צדדים",
    ]);

    const task = extractImportTask(
      ["פלורליס", "רד זיידין", "פיני", "חודשי", "שוטף חודשי", ""],
      mapping,
      { פיני: "user-3" }
    );

    expect(task).toMatchObject({
      networkName: "פלורליס",
      branchName: "רד זיידין",
      sidesRequired: 0,
      assignedTo: "user-3",
    });
  });
});