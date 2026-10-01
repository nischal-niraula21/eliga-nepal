import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true, trim: true },
    linkUrl: { type: String, default: "", trim: true },
    audience: {
      type: String,
      enum: ["ALL", "LOGGED_IN", "NEW_SIGNUPS"],
      default: "ALL",
      index: true
    },
    displayOrder: { type: Number, default: 0 },
    startsAt: { type: Date, default: null, index: true },
    expiresAt: { type: Date, default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

announcementSchema.index({ isActive: 1, displayOrder: 1, createdAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
