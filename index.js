const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const app = express()
// middleWare
app.use(cors())
app.use(express.json())

// console.log(process.env.DB_USER, process.env.DB_PASS)
app.get('/', (req, res) => {
  res.send('summer camp school')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.czarj6h.mongodb.net/?retryWrites=true&w=majority`;


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
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    //collections
    const usersCollection = client.db('summerCampDB').collection('users')
    const classCollention = client.db('summerCampDB').collection('class')

    //user related routes
    app.post('/createUser', async (req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)
      res.send(result)
      // console.log(user)
    })
    app.get('/allUser', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // instructor
    app.get('/instructor',async (req, res) => {
      const role = {role: "instructor"}//instructor
      const result = await usersCollection.find(role).toArray()
      res.send(result)
    })

    // class related 
    app.post('/saveClass', async (req, res) => {
      const classes = req.body
      const result = await classCollention.insertOne(classes)
      res.send(result)
    })

    app.get('/class/:email', async (req, res) => {
      const email = req.params.email
      // console.log(email)
      const query = { email: email }
      const result = await classCollention.find(query).toArray()
      res.send(result)
    })

    app.delete('/removeClas/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await classCollention.deleteOne(query)
      res.send(result)
    })

    app.put('/updateClas/:id', async (req, res) => {
      const newClass = req.body
      // console.log(newClass)
      const id = req.params.id
       const filter = {_id: new ObjectId(id)}
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          className: newClass.className,
            price: newClass.price,
            sets: newClass.sets,
            photo: newClass.photo
        },
      };
      const result = await classCollention.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log('summer camp server running')
})