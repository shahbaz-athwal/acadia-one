import { useExploreCourses } from "@/hooks/use-explore-courses";

export function CourseViewData() {
  const { courses } = useExploreCourses();

  return (
    <div className="space-y-2 p-4">
      {courses.length === 0 && (
        <p className="text-muted-foreground text-sm">No courses found.</p>
      )}

      {courses.map((course) => (
        <div
          className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
          key={course.id}
        >
          <div className="font-medium">
            {course.code} — {course.title}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {course.credits} cr · {course.sections.length} section
            {course.sections.length !== 1 && "s"}
          </div>
          <ul className="mt-1 space-y-0.5 pl-3 text-muted-foreground">
            {course.sections.map((s) => (
              <li key={s.id}>
                {s.sectionCode} · {s.professorName} · days [{s.days.join(",")}]
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
