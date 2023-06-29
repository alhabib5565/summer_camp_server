require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const app = express()
// middleWare
app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authrization = req.headers.authrization
  if (!authrization) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  const token = authrization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
    // console.log(authrization)
    if (error) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.decoded = decoded
    next()
    console.log('gello')
  })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.czarj6h.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
const dbConnect = async () => {
  try {
    client.connect();
    console.log("Database Connected Successfully✅");

  } catch (error) {
    console.log(error.name, error.message);
  }
}
dbConnect()
//collections
const usersCollection = client.db('summerCampDB').collection('users')
const classCollention = client.db('summerCampDB').collection('class')
const selectClassCollection = client.db('summerCampDB').collection('selecClass')
app.get('/', (req, res) => {
  res.send('summer camp school')
})

const verifyInstructor = async (req, res, next) => {
  const email = req.decoded.email
  const query = { email: email }
  const user = await usersCollection.findOne(query)

  if (user?.role !== 'instructor') {
    return res.status(403).send({ error: true, message: 'forbidden message' });
  }
  next();
}

app.post('/ganarate_jwt', (req, res) => {
  const body = req.body
  const token = jwt.sign(body, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
  res.send({ token })
})

//---------------select class --------------------
app.post('/select', async (req, res) => {
  const clss = req.body;
  const result = await selectClassCollection.insertOne(clss);
  res.send(result);
})


app.get('/mySelectClass',verifyJWT, async (req, res) => {
  const email = req.query.email;
  console.log('selectclass', email)
  if (!email) {
    res.send([]);
  }
  const decodedEmail = req.decoded.email;
  if (email !== decodedEmail) {
    return res.status(403).send({ error: true, message: 'forbidden access' })
  }

  const query = { email: email };
  const result = await selectClassCollection.find(query).toArray();
  res.send(result);
});

//admin
app.get('/users/admin/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;

  if (req.decoded.email !== email) {
    res.send({ admin: false })
  }
  const query = { email: email }
  const user = await usersCollection.findOne(query);
  const result = { admin: user?.role === 'admin' }
  res.send(result);
})

//instructor
app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;

  if (req.decoded.email !== email) {
    res.send({ instructor: false })
  }
  const query = { email: email }
  const user = await usersCollection.findOne(query);
  const result = { instructor: user?.role === 'instructor' }
  res.send(result);
})

//user related routes
app.post('/createUser', async (req, res) => {
  const user = req.body
  const email = user.email
  const query = { email: email }
  const existing = await usersCollection.findOne(query)
  if (existing) {
    return res.send('user already exist')
  }
  const result = await usersCollection.insertOne(user)
  res.send(result)

})

app.get('/allUser', async (req, res) => {
  const result = await usersCollection.find().toArray()
  res.send(result)
})

app.put('/users/admin/:id', async (req, res) => {
  const id = req.params.id
  const filter = { _id: new ObjectId(id) }

  const updateDoc = {
    $set: {
      role: 'admin'
    }
  }
  const result = await usersCollection.updateOne(filter, updateDoc)
  res.send(result)
})

app.patch('/users/instructor/:id', async (req, res) => {
  const id = req.params.id
  const filter = { _id: new ObjectId(id) }

  const updateDoc = {
    $set: {
      role: 'instructor'
    }
  }
  const result = await usersCollection.updateOne(filter, updateDoc)
  res.send(result)
})

// instructor
app.get('/instructor', async (req, res) => {
  const role = { role: "instructor" }//instructor
  const result = await usersCollection.find(role).toArray()
  res.send(result)
})

// class related 
app.post('/saveClass', async (req, res) => {
  const classes = req.body
  const result = await classCollention.insertOne(classes)
  res.send(result)
})

app.get('/allClass', async (req, res) => {
  const result = await classCollention.find().toArray()
  res.send(result)
})
app.get('/approveClass', async (req, res) => {
  const status = { status: "approve" }
  const result = await classCollention.find(status).toArray()
  res.send(result)
})
// app.get('/instructor', async (req, res) => {
//   const role = { role: "instructor" }//instructor
//   const result = await usersCollection.find(role).toArray()
//   res.send(result)
// })

app.get('/class/:email', verifyJWT, verifyInstructor, async (req, res) => {
  const email = req.params.email

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

app.patch('/class/approve/:id', async (req, res) => {
  const id = req.params.id
  const body = req.body
  const filter = { _id: new ObjectId(id) }
  const updateDoc = {
    $set: {
      status: body.status,
    }
  }
  const result = await classCollention.updateOne(filter, updateDoc)
  res.send(result)
})
/*    app.patch('/users/instructor/:id',async (req, res) => {
     const id = req.params.id
     const filter = {_id: new ObjectId(id)}
     
     const updateDoc = {
       $set: {
         role: 'instructor'
       }
     }
     const result = await usersCollection.updateOne(filter,updateDoc)
     res.send(result)
   }) */

app.put('/updateClas/:id', async (req, res) => {
  const newClass = req.body

  const id = req.params.id
  const filter = { _id: new ObjectId(id) }
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


app.listen(port, () => {
  console.log('summer camp server running')
})