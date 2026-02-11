import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const SCHEDULE_COLORS = [
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

export const addSection = mutation({
  args: {
    sessionId: v.string(),
    sectionId: v.id("sections"),
  },
  returns: v.object({
    id: v.id("scheduleItems"),
    color: v.string(),
  }),
  handler: async (ctx, args) => {
    // Verify the section exists
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new ConvexError("Section not found");
    }

    // Check for duplicate
    const existing = await ctx.db
      .query("scheduleItems")
      .withIndex("by_sessionId_and_sectionId", (q) =>
        q.eq("sessionId", args.sessionId).eq("sectionId", args.sectionId)
      )
      .first();

    if (existing) {
      throw new ConvexError("Section already in schedule");
    }

    // Count existing items to determine color
    const existingItems = await ctx.db
      .query("scheduleItems")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const color =
      SCHEDULE_COLORS[existingItems.length % SCHEDULE_COLORS.length];

    const id = await ctx.db.insert("scheduleItems", {
      sessionId: args.sessionId,
      sectionId: args.sectionId,
      color,
      addedAt: Date.now(),
    });

    return { id, color };
  },
});

export const removeSection = mutation({
  args: {
    sessionId: v.string(),
    sectionId: v.id("sections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("scheduleItems")
      .withIndex("by_sessionId_and_sectionId", (q) =>
        q.eq("sessionId", args.sessionId).eq("sectionId", args.sectionId)
      )
      .first();

    if (!item) {
      throw new ConvexError("Section not in schedule");
    }

    await ctx.db.delete(item._id);
    return null;
  },
});

export const get = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("scheduleItems")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const enriched = await Promise.all(
      items.map(async (item) => {
        const section = await ctx.db.get(item.sectionId);
        if (!section) {
          return null;
        }

        const course = await ctx.db.get(section.courseId);
        if (!course) {
          return null;
        }

        const professor = section.professorId
          ? await ctx.db.get(section.professorId)
          : null;

        return {
          scheduleItemId: item._id,
          color: item.color,
          section: {
            id: section.externalId,
            termCode: section.termCode,
            sectionCode: section.sectionCode,
            classStartTime: section.classStartTime,
            classEndTime: section.classEndTime,
            days: section.days,
            buildingName: section.buildingName,
            roomNumber: section.roomNumber,
            isOnline: section.isOnline,
            professorName:
              professor?.name ??
              (section.instructorTBD ? "TBD" : "Unknown Instructor"),
          },
          course: {
            code: course.code,
            title: course.title,
            credits: course.credits,
          },
        };
      })
    );

    return enriched.filter(
      (item): item is NonNullable<typeof item> => item !== null
    );
  },
});
