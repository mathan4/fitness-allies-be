require('dotenv').config()
const userModel= require("../model/userModel")
const bcrypt= require("bcryptjs")
const jwt= require("jsonwebtoken")
const JWT_TOKEN = process.env.JWT_TOKEN

const signup=async(request,response)=>{
    const userData=request.body
    console.log(userData)
    try {
        const existingUser= await userModel.findOne({email:userData.email})
        if(existingUser){
            return response.status(401).send({message:"user already exists"})     
        }
        const hashedpassword= await bcrypt.hash(userData.password,10)
        const newUser= new userModel({
            name:userData.name,
            bio:userData.bio,
            email:userData.email,
            password:hashedpassword
        })
        const addedUser=await newUser.save()
        return response.status(201).send(addedUser)
        
    } catch (error) {
        response.status(500).send({message: error.message})
        console.log(userData)
    }
    
}

const login = async (request, response) => {
    const userData = request.body

    try {
        const validUser = await userModel.findOne({ email: userData.email })
        if (!validUser) {
            return response.status(404).send({ message: "Invalid email" })
        }

        // Check if password matches
        const isPasswordValid = await bcrypt.compare(userData.password, validUser.password)
        if (isPasswordValid) {
            // Include userId in the JWT payload
            const AUTH_TOKEN = jwt.sign(
                {
                    userId: validUser._id, // Include userId here
                    email: validUser.email,
                },
                JWT_TOKEN
            )
            return response.status(200).send({ token: AUTH_TOKEN, name: validUser.name, role: validUser.role })
        } else {
            // Return an error if password doesn't match
            return response.status(401).send({ message: "Invalid password" })
        }
    } catch (error) {
        return response.status(500).send({ message: error.message })
    }
}
module.exports={login,signup}