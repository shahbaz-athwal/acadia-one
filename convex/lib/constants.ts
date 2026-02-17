export const SCHEDULE_COLORS = [
  "#4A90D9", // Soft blue
  "#D96B6B", // Muted coral
  "#5BAE7C", // Sage green
  "#C07ED4", // Soft purple
  "#E09B4F", // Warm amber
  "#4DC4C4", // Teal
  "#D47EA3", // Dusty rose
  "#7B8FD4", // Periwinkle
  "#A0B856", // Olive green
  "#D4A04E", // Golden
];

export const RMP_ACADIA_ID = "U2Nob29sLTE0MDY=";
export const AI_MAPPING_PROMPT = `
You are tasked with matching professor records from our local database with Rate My Professor records.
Instructions:
- Match each local professor to their corresponding RMP professor based on name and department
- Use the RMP professor's "id" field (not legacyId) as the rmpId
- If no clear match exists, set rmpId to null
- Consider variations in name format (e.g., "John Smith" vs "Smith, John")
- Department names may differ but should be similar
- Return matches for ALL local professors, even if rmpId is null

Return a JSON object with a "matches" array containing objects with:
- professorId: the id from local professor
- rmpId: the id from RMP professor (or null if no match)
`;
