import { CardHeader, CardTitle } from "@/components/ui/card";

export function CourseViewHeader() {
  return (
    <CardHeader className="flex items-center justify-between gap-2 pt-4 pb-2">
      <CardTitle className="font-semibold text-base">Courses</CardTitle>
      {/* Input for search */}
    </CardHeader>
  );
}
