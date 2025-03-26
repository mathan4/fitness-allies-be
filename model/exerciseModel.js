// backend/models/exerciseModel.js
const mongoose = require("mongoose")

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: [
      "cardio",
      "strength",
      "yoga",
      "pilates",
      "flexibility",
      "hiit",
      "functional",
    ],
    required: true,
  },
  muscleGroups: [
    {
      type: String,
      enum: [
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "quads",
        "hamstrings",
        "calves",
        "glutes",
        "core",
        "cardio",
        "legs",
        "full_body",
      ],
    },
  ],
  equipment: [{ type: String }],
  instructions: { type: String },
  difficulty: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    required: true,
  },
  videoUrl: { type: String },
  imageUrl: { type: String },
  benefits: [{ type: String }],
  caloriesBurnedPerMinute: { type: Number },
  alternatives: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model("Exercise", exerciseSchema)
