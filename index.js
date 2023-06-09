const express = require('express');
const port = process.env.PORT || 5000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken')


const app = express();
// app.use(cors());
app.use(cors())
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}



const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@phero.lyjn1mj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const courseCollections = client.db("campSporty").collection("courses");
    const instructorCollection= client.db("campSporty").collection("instructors");
const selectedCoursesCollection= client.db('campSporty').collection('selectedCourses')
   app.post('/jwt',(req,res)=>{
    const user = req.body
    const token = jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'1h'})
    res.send({token})
   })

//all Courses get operation

app.get('/courses', async (req, res) => {
    
    const result = await courseCollections.find().sort({ enrolledStudents: -1 }).toArray();
    res.send(result);
  })

  app.get('/instructors', async (req, res) => {
    
    const result = await instructorCollection.find().toArray();
    res.send(result);
  })
  app.get('/selectedcourse', async (req, res) => {
    
    const result = await selectedCoursesCollection.find().toArray();
    res.send(result);
  })

app.post('/selectedcourse',async (req,res)=>{
  const body = req.body
  const result = await selectedCoursesCollection.insertOne(body)
  res.send(result)
})



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  } 
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('SportifySports is running');
  });
  
  app.listen(port, () => {
    console.log(`SportifySports API is running on port: ${port}`);
  });