import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const addSection = mutation({
  args: {
    sessionId: v.string(),
    sectionId: v.id("sections"),
    color: v.string(),
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

    const id = await ctx.db.insert("scheduleItems", {
      sessionId: args.sessionId,
      sectionId: args.sectionId,
      color: args.color,
      addedAt: Date.now(),
    });

    return { id, color: args.color };
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

export const removeScheduleItem = mutation({
  args: {
    sessionId: v.string(),
    scheduleItemId: v.id("scheduleItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.scheduleItemId);
    if (!item || item.sessionId !== args.sessionId) {
      throw new ConvexError("Schedule item not found");
    }
    await ctx.db.delete(args.scheduleItemId);
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
          sectionDbId: item.sectionId,
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
