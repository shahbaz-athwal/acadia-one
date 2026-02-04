import type { ExploreSort } from "@/features/explore/query-state";

type SortOption = {
  value: string;
  label: string;
  sort: ExploreSort;
};

const academicLevelOptions = Array.from({ length: 10 }, (_, index) => ({
  value: index,
  label: `Level ${index}`,
}));

const sortOptions: SortOption[] = [
  {
    value: "title:asc",
    label: "Title (A-Z)",
    sort: { key: "title", dir: "asc" },
  },
  {
    value: "title:desc",
    label: "Title (Z-A)",
    sort: { key: "title", dir: "desc" },
  },
  {
    value: "difficulty:asc",
    label: "Difficulty (Low-High)",
    sort: { key: "difficulty", dir: "asc" },
  },
  {
    value: "difficulty:desc",
    label: "Difficulty (High-Low)",
    sort: { key: "difficulty", dir: "desc" },
  },
  {
    value: "numRatings:asc",
    label: "Ratings (Few-Many)",
    sort: { key: "numRatings", dir: "asc" },
  },
  {
    value: "numRatings:desc",
    label: "Ratings (Many-Few)",
    sort: { key: "numRatings", dir: "desc" },
  },
  {
    value: "courseLevel:asc",
    label: "Course Level (Low-High)",
    sort: { key: "courseLevel", dir: "asc" },
  },
  {
    value: "courseLevel:desc",
    label: "Course Level (High-Low)",
    sort: { key: "courseLevel", dir: "desc" },
  },
];

export { academicLevelOptions, sortOptions };
export type { SortOption };
