const express = require('express');
const port = process.env.PORT || 5000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
require('dotenv').config();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)


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

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@phero.lyjn1mj.mongodb.net/?retryWrites=true&w=majority`;

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

    const usersCollections = client.db("campSporty").collection("users");
    const courseCollections = client.db("campSporty").collection("courses");
    const instructorCollection = client.db("campSporty").collection("instructors");
    const selectedCoursesCollection = client.db('campSporty').collection('selectedCourses')
    const paymentCollection = client.db("campSporty").collection("payments");

    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })



    // user related api


    app.get('/users',async(req,res)=>{
      const result = await usersCollections.find().toArray()
      res.send(result)
    })
    app.post('/users',async(req,res)=>{

      const user = req.body
      const query = {email:user.email}
      const alreadyLoginUser = await usersCollections.findOne(query)
      if(alreadyLoginUser){
        return res.send({message:'user already exists'})
      }
      const result = await usersCollections.insertOne(user)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await usersCollections.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollections.updateOne(filter, updateDoc);
      res.send(result);

    })


    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await usersCollections.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollections.updateOne(filter, updateDoc);
      res.send(result);

    })

    //all Courses get operation

    app.get('/courses', async (req, res) => {

      const result = await courseCollections.find().sort({ availableSeats: 1}).toArray();
      res.send(result);
    })
    app.post('/courses',async(req,res)=>{
      const body = req.body
      const result = await courseCollections.insertOne(body)
    })
    app.patch('/courses/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await courseCollections.updateOne(filter, updateDoc);
      res.send(result);

    })
    app.get('/instructors', async (req, res) => {

      const result = await instructorCollection.find().toArray();
      res.send(result);
    })
    app.get('/selectedcourse', async (req, res) => {
      const email = req.query.email
      if(!email){
        res.send([])
        return
      }
      
      // const decodedEmail = req.decoded.email;
      // if (email !== decodedEmail) {
      //   return res.status(403).send({ error: true, message: 'forbidden access' })
      // }

      const result = await selectedCoursesCollection.find({ email }).toArray();
      res.send(result);
    })

    app.post('/selectedcourse', async (req, res) => {
      const { email, ...course } = req.body;

      // Check if the user has already enrolled in the course
      const existingRecord = await selectedCoursesCollection.findOne({
        email: email,
        courseId: course._id
      });

      if (existingRecord) {
        return res.status(400).send({
          error: true,
          message: 'User has already enrolled in this course.'
        });
      }

      // Insert the selected course with the user's email
      const result = await selectedCoursesCollection.insertOne({
        email: email,
        courseId: course._id,
        courseName: course?.courseName,
        enrolledStudents: course?.enrolledStudents,
        price: course?.price,
        availableSeats: course?.availableSeats,
        instructorId: course?.instructorId,
        instructorName: course?.instructorName,
        courseImage: course?.courseImage
      });

      res.send(result);
    });


    app.delete('/selectedcourse/:id', async (req, res) => {
      const courseId = req.params.id;
      try {
        await selectedCoursesCollection.deleteOne({ _id: new ObjectId(courseId) });
        res.status(200).json({ success: true, message: 'Course deleted successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: true, message: 'An error occurred while deleting the course' });
      }
    });

    app.get('/payments', async (req, res) => {
      const query = { email:req.query.email }
      const Result = await paymentCollection.find(query).sort({date:-1}).toArray();
      res.send(Result);
  })

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
      });
      res.send({
          clientSecret: paymentIntent.client_secret
      })
  })

  app.post('/payments', async (req, res) => {
    const payment = req.body;
    const insertResult = await paymentCollection.insertOne(payment);
    const query = { _id: new ObjectId(payment.item) }
    const deletedResult = await selectedCoursesCollection.deleteOne(query)

    const filter = {_id: new ObjectId(payment?.courseId)}
    const updatedDoc={

          $inc:{
            availableSeats:-1,enrolledStudents:1
          }
    }
    const updateResult = await courseCollections.updateOne(filter,updatedDoc)
    res.send({ insertResult, deletedResult ,updateResult});
})



// app.get('/payments', async (req, res) => {
//   const email = req.query.email;
//   const query = { email };
//   const sortOptions = { date: -1 }; // Sort by date in descending order

//   try {
//     const result = await paymentCollection.find(query).sort(sortOptions).toArray();
//     res.send(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// });

    // app.post('/charge', async (req, res) => {
    //   const { paymentMethodId, amount } = req.body;

    //   try {
    //     const paymentIntent = await stripe.paymentIntents.create({
    //       amount,
    //       currency: 'usd',
    //       payment_method: paymentMethodId,
    //       confirm: true,
    //     });

    //     // Handle successful payment
    //     // You can save the paymentIntent.id and other relevant details to your database

    //     res.status(200).send({ success: true, paymentIntent });
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).send({ error: true, message: 'An error occurred during payment processing' });
    //   }
    // });

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