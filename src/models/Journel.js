import mongoose from "mongoose";

const listField = {
  type: [
    {
      type: String,
      trim: true,
      minlength: 1,
      maxlength: 240,
    },
  ],
  default: undefined,
  validate: {
    validator: (arr) => !arr || arr.length <= 3,
    message: "Maximum 3 items allowed.",
  },
};

const morningSchema = new mongoose.Schema(
  {
    gratefulFor: listField,
    topPriorities: listField,
    affirmation: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const eveningSchema = new mongoose.Schema(
  {
    amazingThings: listField,
    prioritiesStatus: {
      type: String,
      enum: ["yes", "partially", "no"],
    },
    improveTomorrow: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const journelSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    morning: {
      type: morningSchema,
      default: undefined,
    },
    evening: {
      type: eveningSchema,
      default: undefined,
    },
    aiReflection: {
      text: {
        type: String,
        trim: true,
      },
      model: {
        type: String,
      },
      generatedAt: {
        type: Date,
      },
    },
  },
  { timestamps: true }
);

journelSchema.index({ userId: 1, date: 1 }, { unique: true });

const Journel = mongoose.model("Journel", journelSchema);
export default Journel;
