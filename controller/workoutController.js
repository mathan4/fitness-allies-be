const WorkoutPlan = require("../model/workoutModel")
const Exercise = require("../model/exerciseModel")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const { GoogleGenerativeAI } = require("@google/generative-ai")
const { request, response } = require("../route/userRoute")

const JWT_SECRET = process.env.JWT_TOKEN
const GEN_API = process.env.GOOGLE_API_KEY
const genAI = new GoogleGenerativeAI(GEN_API)

/**
 * Generate a personalized workout plan using Gemini AI and user preferences.
 */
const generateWorkoutPlan = async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null
    const userId = req.userId

    // Check if a plan already exists for the user
    const existingPlans = await WorkoutPlan.find({ userId: userId })
    console.log(userId)
    console.log(existingPlans)
    if (existingPlans.length > 0) {
      // If plan exists, ask for user confirmation before overriding
      return res.status(200).json({
        message:
          "A workout plan already exists. Do you want to override the existing plan?",
        existingPlan: existingPlans[0], // Return the current plan to the user for reference
        actionRequired: true, // This flag tells the frontend that confirmation is needed
      })
    }

    // Proceed with generating a new workout plan
    else {
      const userInput = validateAndNormalizeInput(req.body, token)

      if (userInput.error) {
        return res.status(400).json({ message: userInput.error })
      }

      const workoutPlan = await generateWorkoutPlanWithGemini(userInput)

      if (!workoutPlan) {
        return res
          .status(500)
          .json({ message: "Failed to generate workout plan with AI." })
      }

      // Process workout days to add exercise IDs
      const processedWorkoutDays = await processWorkoutDaysWithExerciseIds(
        workoutPlan.workoutDays
      )

      // Return the generated plan (not saving yet, as it requires user confirmation)
      return res.status(200).json({
        message: "Workout plan generated successfully",
        workoutPlan: {
          title: userInput.planName,
          description: generateWorkoutDescription(
            userInput.fitnessGoal,
            userInput.fitnessLevel,
            userInput.daysPerWeek
          ),
          fitnessGoal: userInput.fitnessGoal,
          fitnessLevel: userInput.fitnessLevel,
          workoutDays: processedWorkoutDays,
        },
      })
    }
  } catch (error) {
    console.error("Error generating workout plan:", error)
    return res.status(500).json({ message: error.message })
  }
}

const overridePlan = async (request, response) => {
  const authHeader = request.headers.authorization
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : nul
  const userId = request.userId
  // Check if a plan already exists for the user
  const deleted = await WorkoutPlan.findByIdAndDelete({ userId: userId })
  if (deleted) {
    const userInput = validateAndNormalizeInput(request.body, token)

    if (userInput.error) {
      return response.status(400).json({ message: userInput.error })
    }

    const workoutPlan = await generateWorkoutPlanWithGemini(userInput)

    if (!workoutPlan) {
      return response
        .status(500)
        .json({ message: "Failed to generate workout plan with AI." })
    }

    // Process workout days to add exercise IDs
    const processedWorkoutDays = await processWorkoutDaysWithExerciseIds(
      workoutPlan.workoutDays
    )

    // Return the generated plan (not saving yet, as it requires user confirmation)
    return response.status(200).json({
      message: "Workout plan generated successfully",
      workoutPlan: {
        title: userInput.planName,
        description: generateWorkoutDescription(
          userInput.fitnessGoal,
          userInput.fitnessLevel,
          userInput.daysPerWeek
        ),
        fitnessGoal: userInput.fitnessGoal,
        fitnessLevel: userInput.fitnessLevel,
        workoutDays: processedWorkoutDays,
      },
    })
  } else {
    return response
      .status(500)
      .json({ message: "Failed to Override the plan." })
  }
}

/**
 * Process workout days to add exercise IDs for each exercise
 */
const processWorkoutDaysWithExerciseIds = async (workoutDays) => {
  const processedDays = []

  for (const day of workoutDays) {
    const processedExercises = []

    for (const exercise of day.exercises) {
      // Look up the exercise in the database by name
      let foundExercise = await Exercise.findOne({
        name: { $regex: new RegExp(`^${exercise.name}$`, "i") },
      })

      // If not found, create a new exercise entry
      if (!foundExercise) {
        // Determine a default type based on the exercise name (a simple heuristic)
        let exerciseType = "strength" // Default type

        const lowerName = exercise.name.toLowerCase()
        if (
          lowerName.includes("cardio") ||
          lowerName.includes("run") ||
          lowerName.includes("jog") ||
          lowerName.includes("bike") ||
          lowerName.includes("swimming") ||
          lowerName.includes("rowing")
        ) {
          exerciseType = "cardio"
        } else if (
          lowerName.includes("stretch") ||
          lowerName.includes("yoga") ||
          lowerName.includes("mobility") ||
          lowerName.includes("flexibility")
        ) {
          exerciseType = "flexibility"
        }

        foundExercise = await new Exercise({
          name: exercise.name,
          description: exercise.notes || `${exercise.name} exercise`,
          type: exerciseType, // Add the required type field
          muscleGroups: [], // Default empty array, you might want to populate this
          difficulty: "intermediate", // Default value
          equipment: [], // Default empty array
        }).save()
      }

      // Add the exercise with its ID to the processed exercises
      processedExercises.push({
        exerciseId: foundExercise._id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        notes: exercise.notes,
      })
    }

    processedDays.push({
      day: day.day,
      exercises: processedExercises,
      completed: false,
    })
  }

  return processedDays
}

/**
 * Generates a workout plan using Gemini AI.
 */
const generateWorkoutPlanWithGemini = async (userInput) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  const prompt = `Generate a workout plan for a user with the following preferences:
    Fitness Goal: ${userInput.fitnessGoal}
    Fitness Level: ${userInput.fitnessLevel}
    Days Per Week: ${userInput.daysPerWeek}
    Time Per Workout: ${userInput.timePerWorkout} minutes
    Available Equipment: ${userInput.availableEquipment.join(", ")}
    Focus Areas: ${userInput.focusAreas.join(", ")}
    Injuries: ${userInput.injuries.join(", ")}
    Excluded Exercises: ${userInput.excludedExercises.join(", ")}
    Plan Name: ${userInput.planName}

    Return the plan in JSON format, including workout days and exercises with sets, reps, and notes.
    Please provide the workout plan in JSON format. The JSON should include a "workoutDays" array, where each element is an object representing a workout day. Each workout day object should have a "day" field (e.g., "Monday", "Wednesday", "Friday") and an "exercises" array. Each exercise object should include the exercise name, sets, reps, and notes.

Example JSON format:
{
  "workoutDays": [
    {
      "day": "Monday",
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "sets": 3,
          "reps": 8,
          "notes": "Focus on proper form."
        },
        {
          "name": "Barbell Rows",
          "sets": 3,
          "reps": 8,
          "notes": "Keep your back straight."
        }
      ]
    },
    {
      "day": "Wednesday",
      "exercises": [
        // ... more exercises
      ]
    },
    {
       "day": "Friday",
       "exercises": [
         // etc
       ]
    }
  ]
} `

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response

    if (response && response.candidates && response.candidates.length > 0) {
      const contentParts = response.candidates[0].content.parts
      if (contentParts && contentParts.length > 0) {
        let text = contentParts.map((part) => part.text).join("") // Extract all text parts and join them.

        // Remove markdown code blocks
        text = text.replace(/```json\n/g, "")
        text = text.replace(/```/g, "")
        text = text.trim() // Trim whitespace

        try {
          return JSON.parse(text)
        } catch (parseError) {
          console.error("Error parsing Gemini response:", parseError)
          return null
        }
      } else {
        console.error("No content parts found in response.")
        return null
      }
    } else {
      console.error("No candidates found in response.")
      return null
    }
  } catch (error) {
    console.error("Gemini API error:", error)
    return null
  }
}

/**
 * Validate and normalize user input.
 */
const validateAndNormalizeInput = (input, token) => {
  try {
    if (!token) {
      return { error: "Authorization token is required" }
    }

    let decodedToken
    try {
      decodedToken = jwt.verify(token, JWT_SECRET)
    } catch (jwtError) {
      return { error: "Invalid or expired token" }
    }

    const userId = decodedToken.userId

    if (!userId) {
      return { error: "userId not found in token" }
    }

    const validGoals = [
      "weight_loss",
      "muscle_gain",
      "endurance",
      "flexibility",
      "general_fitness",
    ]
    if (!input.fitnessGoal) {
      return { error: "fitnessGoal is required" }
    }
    if (!validGoals.includes(input.fitnessGoal)) {
      return { error: `fitnessGoal must be one of: ${validGoals.join(", ")}` }
    }

    const validLevels = ["beginner", "intermediate", "advanced"]
    if (!input.fitnessLevel) {
      return { error: "fitnessLevel is required" }
    }
    if (!validLevels.includes(input.fitnessLevel)) {
      return {
        error: `fitnessLevel must be one of: ${validLevels.join(", ")}`,
      }
    }

    const result = {
      userId: userId,
      fitnessGoal: input.fitnessGoal,
      fitnessLevel: input.fitnessLevel,
      daysPerWeek: input.daysPerWeek || 3,
      timePerWorkout: input.timePerWorkout || 60,
      planName: input.planName || "My Workout Plan",
      availableEquipment: Array.isArray(input.availableEquipment)
        ? input.availableEquipment
        : [],
      focusAreas: Array.isArray(input.focusAreas) ? input.focusAreas : [],
      excludedExercises: Array.isArray(input.excludedExercises)
        ? input.excludedExercises
        : [],
      injuries: Array.isArray(input.injuries) ? input.injuries : [],
    }

    if (result.daysPerWeek < 1 || result.daysPerWeek > 7) {
      return { error: "daysPerWeek must be between 1 and 7" }
    }

    if (result.timePerWorkout < 15 || result.timePerWorkout > 180) {
      return { error: "timePerWorkout must be between 15 and 180 minutes" }
    }

    return result
  } catch (err) {
    return { error: "Invalid input format or token" }
  }
}

/**
 * Create and save a new workout plan.
 */
const createAndSaveWorkoutPlan = async (
  userId,
  planName,
  fitnessGoal,
  fitnessLevel,
  daysPerWeek,
  workoutDays
) => {
  const startDate = new Date()
  const endDate = new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000)

  const description = `AI Generated plan: ${generateWorkoutDescription(
    fitnessGoal,
    fitnessLevel,
    daysPerWeek
  )}`

  const workoutPlan = new WorkoutPlan({
    userId,
    title: planName,
    description,
    fitnessGoal,
    fitnessLevel,
    workoutDays,
    startDate,
    endDate,
    active: true,
  })

  return await workoutPlan.save()
}

/**
 * Generate a workout description.
 */
const generateWorkoutDescription = (fitnessGoal, fitnessLevel, daysPerWeek) => {
  return `Workout plan generated by AI for ${fitnessLevel} level, ${fitnessGoal} goal, ${daysPerWeek} days per week.`
}
const getWorkoutPlans = async (req, res) => {
  try {
    // Assuming userId is set by the JWT verification middleware
    const userId = req.userId

    // Get current day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const today = new Date()
    const currentDay = today.getDay()
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const currentDayName = dayNames[currentDay]

    // Find all workout plans for the user
    const allPlans = await WorkoutPlan.find({ userId: userId })

    if (!allPlans || allPlans.length === 0) {
      return res
        .status(404)
        .json({ message: "No workout plans found for this user" })
    }

    // Filter plans to only include those with workouts scheduled for today's day
    const todaysPlans = allPlans.filter(plan => {
      return plan.workoutDays.some(day => day.day === currentDayName)
    })

    // If no workouts scheduled for today, find the next scheduled day
    if (todaysPlans.length === 0) {
      let nextWorkoutDay = null
      let daysUntilNextWorkout = Infinity

      allPlans.forEach(plan => {
        plan.workoutDays.forEach(workoutDay => {
          const workoutDayIndex = dayNames.indexOf(workoutDay.day)
          let daysDifference = workoutDayIndex - currentDay
          if (daysDifference < 0) {
            daysDifference += 7 // Wrap around to next week
          }
          if (daysDifference < daysUntilNextWorkout) {
            daysUntilNextWorkout = daysDifference
            nextWorkoutDay = workoutDay.day
          }
        })
      })

      if (nextWorkoutDay) {
        return res.status(200).json({
          message: `No workouts scheduled for today. Your next workout is on ${nextWorkoutDay}.`,
          plans: []
        })
      } else {
        return res.status(200).json({ message: "No workouts scheduled for any day.", plans: [] })
      }
    }

    // Return the filtered plans
    return res.status(200).json(todaysPlans)
  } catch (error) {
    console.error("Error fetching workout plans:", error)
    return res.status(500).json({ message: "Internal Server Error" })
  }
}
const getWorkoutPlanDetails = async (req, res) => {
  try {
    const planId = req.params.planId
    const dayIndex = req.params.dayIndex
    const plan = await WorkoutPlan.findById(planId)
    console.log(planId)

    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found" })
    }
    if (dayIndex === undefined) {
      return res.status(400).json({ message: "Day index is required" })
    }

    // Populate exercise details
    for (const day of plan.workoutDays) {
      if (day.day === dayIndex) {
        // Check if the day matches the dayIndex
        for (const exercise of day.exercises) {
          if (exercise.exerciseId) {
            const foundExercise = await Exercise.findById(exercise.exerciseId)
            exercise.exerciseDetails = foundExercise
          } else if (exercise.name) {
            const foundExercise = await Exercise.findOne({
              name: exercise.name,
            })
            if (foundExercise) {
              exercise.exerciseDetails = foundExercise
            } else {
              console.warn(`Exercise "${exercise.name}" not found.`)
            }
          }
        }
      }
    }

    return res.status(200).json(plan)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

const completeWorkoutDay = async (req, res) => {
  try {
    const planId  = req.params.planId
    const dayIndex=req.params.dayIndex
 
    const plan = await WorkoutPlan.findById(planId)
    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found" })
    }
    if (plan.workoutDays[dayIndex]) {
      plan.workoutDays[dayIndex].completed = true
      await plan.save()
      return res.status(200).json({ message: "Workout day completed" })
    } else {
      return res.status(400).json({ message: "Invalid day index" })
    }
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

const updateWorkoutPlan = async (req, res) => {
  try {
    const planId = req.params.planId
    const updateData = req.body
    const updatedPlan = await WorkoutPlan.findByIdAndUpdate(
      planId,
      updateData,
      { new: true }
    )
    if (!updatedPlan) {
      return res.status(404).json({ message: "Workout plan not found" })
    }
    return res.status(200).json(updatedPlan)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

const deleteWorkoutPlan = async (req, res) => {
  try {
    const planId = req.params.planId
    const deletedPlan = await WorkoutPlan.findByIdAndDelete(planId)
    if (!deletedPlan) {
      return res.status(404).json({ message: "Workout plan not found" })
    }
    return res
      .status(200)
      .json({ message: "Workout plan deleted successfully" })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

const getWorkoutPlansByUser = async (req, res) => {
  try {
    const userId = req.userId
    const plans = await WorkoutPlan.find({ userId: userId })
    return res.status(200).json(plans)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

const markExerciseCompleted = async (req, res) => {
  try {
    const { planId, dayIndex, exerciseIndex } = req.body

    const plan = await WorkoutPlan.findById(planId)
    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found" })
    }
    if (!plan.workoutDays[dayIndex]) {
      return res.status(404).json({ message: "Workout day not found" })
    }
    if (!plan.workoutDays[dayIndex].exercises[exerciseIndex]) {
      return res.status(404).json({ message: "Exercise not found" })
    }

    plan.workoutDays[dayIndex].exercises[exerciseIndex].completed = true

    await plan.save()


    return res.status(200).json({ message: "Exercise marked as completed" })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

const markExerciseIncomplete = async (req, res) => {
  try {
    const { planId, dayIndex, exerciseIndex } = req.body

    const plan = await WorkoutPlan.findById(planId)
    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found" })
    }
    if (!plan.workoutDays[dayIndex]) {
      return res.status(404).json({ message: "Workout day not found" })
    }
    if (!plan.workoutDays[dayIndex].exercises[exerciseIndex]) {
      return res.status(404).json({ message: "Exercise not found" })
    }

    plan.workoutDays[dayIndex].exercises[exerciseIndex].completed = false
    await plan.save()

    return res.status(200).json({ message: "Exercise marked as incomplete" })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

const saveWorkoutPlan = async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null

    if (!token) {
      return res
        .status(401)
        .json({ message: "Authorization token is required" })
    }

    let decodedToken
    try {
      decodedToken = jwt.verify(token, JWT_SECRET)
    } catch (jwtError) {
      return res.status(401).json({ message: "Invalid or expired token" })
    }

    const userId = decodedToken.userId
    const { planName, planData } = req.body

    if (!planData || !planData.workoutDays) {
      return res.status(400).json({ message: "Invalid plan data provided" })
    }

    // Create a new workout plan in the database
    const startDate = new Date()
    // Check if required fields exist and provide defaults if needed
    const fitnessGoal =
      planData.fitnessGoal || req.body.fitnessGoal || "general_fitness"
    const fitnessLevel =
      planData.fitnessLevel || req.body.fitnessLevel || "intermediate"

    const description =
      planData.description ||
      `AI Generated plan: ${generateWorkoutDescription(
        fitnessGoal,
        fitnessLevel,
        planData.workoutDays.length
      )}`

    // Create and save the workout plan
    const workoutPlan = new WorkoutPlan({
      userId,
      title: planName || planData.title || "My Workout Plan",
      description: description,
      fitnessGoal: fitnessGoal,
      fitnessLevel: fitnessLevel,
      workoutDays: planData.workoutDays,
      startDate,
      active: true,
    })

    const savedPlan = await workoutPlan.save()

    return res.status(201).json({
      message: "Workout plan saved successfully",
      plan: savedPlan,
    })
  } catch (error) {
    console.error("Error saving workout plan:", error)
    return res.status(500).json({ message: error.message })
  }
}
// These functions should be added to your existing workoutController.js file

/**
 * Check for missed workouts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkMissedWorkouts = async (req, res) => {
  try {
    const userId = req.userId
    console.log(userId)

    // Get all active workout plans for the user
    const activePlans = await WorkoutPlan.find({
      userId: userId,
      isActive: true,
    })

    const missedWorkouts = []

    // Check each plan for missed workouts
    for (const plan of activePlans) {
      // Logic to determine missed workouts
      // Example: Find workout days that were scheduled but not completed
      const today = new Date()

      // Calculate missed workouts based on schedule and completion status
      for (const workoutDay of plan.workoutDays) {
        if (!workoutDay.completed && workoutDay.scheduledDate < today) {
          missedWorkouts.push({
            planId: plan._id,
            planName: plan.title,
            dayIndex: plan.workoutDays.indexOf(workoutDay),
            day: workoutDay.day,
            scheduledDate: workoutDay.scheduledDate,
          })
        }
      }
    }

    return res.status(200).json({
      success: true,
      missedWorkouts,
    })
  } catch (error) {
    console.error("Error checking missed workouts:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to check for missed workouts",
    })
  }
}

/**
 * Mark a workout as complete (legacy endpoint)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const markWorkoutComplete = async (req, res) => {
  try {
    const { planId, dayIndex } = req.body


    if (!planId || dayIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Plan ID and day index are required",
      })
    }

    const workoutPlan = await WorkoutPlan.findById(planId)

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      })
    }

    // Check if user has permission
    if (workoutPlan.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this plan",
      })
    }

    // Update the completion status of the workout day
    if (workoutPlan.workoutDays[dayIndex]) {
      workoutPlan.workoutDays[dayIndex].completed = true
      workoutPlan.workoutDays[dayIndex].completedDate = new Date()

      // Mark all exercises as completed
      workoutPlan.workoutDays[dayIndex].exercises.forEach((exercise) => {
        exercise.completed = true
      })

      await workoutPlan.save()

      return res.status(200).json({
        success: true,
        message: "Workout marked as complete",
      })
    } else {
      return res.status(404).json({
        success: false,
        message: "Workout day not found",
      })
    }
  } catch (error) {
    console.error("Error marking workout as complete:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to mark workout as complete",
    })
  }
}
// Remember to add these to your module.exports in workoutController.js

module.exports = {
  generateWorkoutPlan,
  overridePlan,
  saveWorkoutPlan,
  getWorkoutPlans,
  getWorkoutPlanDetails,
  completeWorkoutDay,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  getWorkoutPlansByUser,
  markExerciseCompleted,
  markExerciseIncomplete,
  markWorkoutComplete,
  checkMissedWorkouts,
}
