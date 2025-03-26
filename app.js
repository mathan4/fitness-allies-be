require('dotenv').config()
const express = require('express')
const app = express()
const userRoute = require('./route/userRoute')
const workoutRoutes = require('./route/workoutRoute');
const mongoose = require('mongoose')
const cors = require('cors')
const PORT = process.env.PORT

mongoose.connect(process.env.DB_URL)
const db = mongoose.connection
db.on('error', (errorMessage) => console.log(errorMessage))
db.once('open', () => console.log(`Connected successfully to database`))

app.use(cors())
app.use(express.json())

app.use('/api/v1/fitnessAllies/user', userRoute)
app.use('/api/v1/fitnessAllies/workout',workoutRoutes)

app.listen(PORT, console.log(`Server started running at http://localhost:${PORT}/api/v1/fitnessAllies/`))