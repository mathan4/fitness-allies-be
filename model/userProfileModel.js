// backend/models/userProfileModel.js
const mongoose = require("mongoose")

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
    unique: true,
  },
  age: { type: Number },
  gender: { type: String },
  height: { type: Number },
  weight: { type: Number },
  fitnessGoals: [{ type: String }],
  preferredWorkoutDays: [{ type: String }],
  availableEquipment: [{ type: String }],
  injuries: [{ type: String }],
  medicalConditions: [{ type: String }],
  workoutHistory: { type: String },
  preferredExercises: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
    },
  ],
  excludedExercises: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserProfile", userProfileSchema)
