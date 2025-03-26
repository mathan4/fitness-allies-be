// backend/models/workoutModel.js
const mongoose = require("mongoose")

const workoutDaySchema = new mongoose.Schema({
  day: { type: String, required: true },
  exercises: [
    {
      exerciseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Exercise",
        required: true,
      },
      name: { type: String },
      sets: { type: Number },
      reps: { type: mongoose.Schema.Types.Mixed },
      duration: { type: Number },
      weight: { type: Number },
      restTime: { type: Number },
      notes: { type: String },
    },
  ],
  completed: { type: Boolean, default: false },
})

const workoutPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String },
  fitnessGoal: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'endurance', 'flexibility', 'general_fitness'],
    required: true,
  },
  fitnessLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true,
  },
  workoutDays: [workoutDaySchema],
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema)