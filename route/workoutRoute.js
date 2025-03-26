const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/verifyUser')
const {
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
  checkMissedWorkouts,  
  markWorkoutComplete, 
} = require('../controller/workoutController')

// Generate a workout plan
router.post('/generate-plan', verifyToken, generateWorkoutPlan)
router.post('/override-plan', verifyToken, overridePlan)
router.post('/save-plan', verifyToken, saveWorkoutPlan)

// Get all workout plans for a user
router.get('/', verifyToken, getWorkoutPlans)

// Get workout plans by user ID
router.get('/user', verifyToken, getWorkoutPlansByUser)

// Check for missed workouts - add this missing route
router.get('/check-missed', verifyToken, checkMissedWorkouts)

// Get details of a specific workout plan
router.get('/:planId/:dayIndex', verifyToken, getWorkoutPlanDetails)

// Legacy route for marking workout as complete
router.post('/mark-complete', verifyToken, markWorkoutComplete)

// Mark a workout day as completed
router.patch('/:planId/complete-day/:dayIndex', verifyToken, completeWorkoutDay)

// Mark an exercise as completed
router.patch('/:planId/complete-exercise/:dayIndex/:exerciseIndex', verifyToken, markExerciseCompleted)

// Mark an exercise as incomplete
router.patch('/:planId/incomplete-exercise/:dayIndex/:exerciseIndex', verifyToken, markExerciseIncomplete)

// Update a workout plan
router.patch('/:id', verifyToken, updateWorkoutPlan)

// Delete a workout plan
router.delete('/:id', verifyToken, deleteWorkoutPlan)

module.exports = router