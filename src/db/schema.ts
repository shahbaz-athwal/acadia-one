// oxlint-disable sort-keys
import { index, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const terms = sqliteTable(
  "terms",
  {
    termCode: text().notNull().primaryKey(),
    name: text().notNull(),
    endDate: int({ mode: "timestamp" }).notNull(),
    startDate: int({ mode: "timestamp" }).notNull(),
    isArchived: int({ mode: "boolean" }).notNull(),
  },
  (table) => [index("terms_by_is_archived").on(table.isArchived)]
);

export const departments = sqliteTable("departments", {
  prefix: text().notNull().primaryKey(),
  name: text().notNull(),
  facultyUrl: text().notNull(),
});
