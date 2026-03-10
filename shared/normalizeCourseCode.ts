export function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
