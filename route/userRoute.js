const express=require("express")
const { signup, login } = require("../controller/userController")
const verifyToken = require("../middleware/verifyUser")
const route=express()

route.post('/signup',signup)
route.post('/login',login)
route.get('/home',verifyToken)

module.exports=route