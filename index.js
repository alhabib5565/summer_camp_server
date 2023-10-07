require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.Payment_secrte)

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const app = express()
const morgan = require('morgan')
// middleWare
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

const verifyJWT = (req, res, next) => {
  const authrization = req.headers.authorization
  // console.log('authorization token',authrization)
  if (!authrization) {
    return res.status(401).send({ message: 'unauthorized access' })
  }

  const token = authrization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.decoded = decoded
    next()
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
const enrolledClassCollection = client.db('summerCampDB').collection('enrolled')
app.get('/', (req, res) => {
  res.send('E_class server')
})

const verifyInstructor = async (req, res, next) => {
  const email = req.decoded.email
  const query = { email: email }
  const user = await usersCollection.findOne(query)

  if (user?.role !== 'instructor') {
    return res.status(403).send({ error: true, message: 'forbidden access' });
  }
  next();
}

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email }
  const user = await usersCollection.findOne(query);
  if (user?.role !== 'admin') {
    return res.status(403).send({ error: true, message: 'forbidden message' });
  }
  next();
}


// create payment intent
app.post('/create-payment-intent', verifyJWT, async (req, res) => {
  const { price } = req.body
  console.log(price)
  const amount = parseFloat(price) * 100
  if (!price) return
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types: ['card'],
  })

  res.send({
    clientSecret: paymentIntent.client_secret,
  })
})


app.post('/ganarate_jwt', (req, res) => {
  const body = req.body
  const token = jwt.sign(body, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
  res.send({ token })
})

// ---------------enrolled class ---------------------
app.post('/enrolled', verifyJWT, async (req, res) => {
  const enrolledClss = req.body;
  const query = { classId: enrolledClss.classId, studentEmail: enrolledClss.studentEmail };
  console.log('query', query);
  const existClass = await enrolledClassCollection.findOne(query)
  console.log(existClass)
  if (existClass) {
    return res.send({ message: 'already exist' })
  }
  const result = await enrolledClassCollection.insertOne(enrolledClss);
  res.send(result);
})

// --------------all enroll class for user -------------------
app.get('/enrollClass', verifyJWT, async (req, res) => {
  const email = req.query.email
  const query = { studentEmail: email }
  const result = await enrolledClassCollection.find(query).toArray()
  res.send(result)
})

// ---------------- total enroll class --------------
app.get('/totalEnroled', verifyJWT, verifyAdmin, async (req, res) => {
  const result = await enrolledClassCollection.find().toArray()
  res.send(result)
})


//----------------------- popular class --------------------------
app.get("/popularCls", async (req, res) => {
  const jobs = await classCollention.find({}).sort({ enrolled: -1 }).toArray();
  res.send(jobs);
});

// ------------------------ popular instructor ------------------
app.get('/populerInstructor', async (req, res) => {
  const limit = 6; // Limit set to 6
  const sortBy = { enrolled: -1 }; // Sort in descending order based on the students field

  const result = await classCollention.find().sort(sortBy).limit(limit).toArray();
  res.send(result);
});

//--------------------------increse enrolld sets after enrolled successfull-----------------
app.patch('/reduceSets/:id', async (req, res) => {
  const id = req.params.id
  const filter = { _id: new ObjectId(id) }
  const clss = await classCollention.findOne(filter)
  if (!clss) {
    return res.status(404).send({ error: 'Class not found' });
  }
  const currentlyEnrolled = clss.enrolled
  const updateSetNum = {
    $set: {
      enrolled: currentlyEnrolled + 1
    }
  }
  const result = await classCollention.updateOne(filter, updateSetNum)
  res.send(result)
})


//---------------select class--------------------
app.post('/select', async (req, res) => {
  const clss = req.body
  const exist = await selectClassCollection.findOne({
    $and: [
      { classId: clss.classId },
      { studentEmail: clss.studentEmail }
    ]
  })
  console.log(exist)
  if (exist) {
    return res.send({ message: 'alredy bookmark' })
  } else {
    const result = await selectClassCollection.insertOne(clss);
    res.send(result);
  }
})

// delete from select
app.get('/mySelectClass/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;
  if (!email) {
    res.send([]);
  }
  const decodedEmail = req.decoded.email;
  if (email !== decodedEmail) {
    return res.status(403).send({ error: true, message: 'forbidden access' })
  }

  const query = { studentEmail: email };
  const result = await selectClassCollection.find(query).toArray();
  res.send(result);
});

// -----------------------myselect class delete -------------------------
app.delete('/select/delete/:id', verifyJWT, async (req, res) => {
  const id = req.params.id
  const query = { _id: new ObjectId(id) }
  const result = await selectClassCollection.deleteOne(query)
  res.send(result)
})

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
    return res.send({message:'user already exist'})
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

app.get('/approveClassNumber', async (req, res) => {
  const status = { status: "approve" }
  const result = await classCollention.find(status).toArray()
  const totalApproveClass = { totalApproveClass: result.length }
  res.send(totalApproveClass)
})

// just practice
// app.get('/approveClassNumber', async (req, res) => {
//   const status = { status: "approve" }
//   const result = await classCollention.find(status).toArray()
//   const totalApproveClass = { totalApproveClass: result.length }
//   res.send(totalApproveClass)
// })
// app.get('/approveClsAggregate', async (req, res) => {
//   const totalEnrolled = await classCollention.aggregate([
//     {
//       $match: { status: "approve" } // Filter only "approve" status
//     },
//     {
//       $group: {
//         "_id": {
//           "status": "$status",
//           "instructorName": "$instructorName",
//           "instructorEmail": "$instructorEmail",
//           "instructorPhoto": "$instructorPhoto",
//           "enrolled": '$enrolled'
//         },
//         "enrolled": { $sum: 1 }
//       }
//     },
//     {
//       $sort: { enrolled: -1 } // Sort by "totalEnrolled" in descending order
//     }
//   ]).toArray()
//   res.send(totalEnrolled)
// })

// --------------------get all approve class with paginations---------------------------
app.get('/approveClass', async (req, res) => {
  console.log(req.query)
  const currentPage = parseInt(req.query.currentPage) || 0
  const itemsPerPage = parseInt(req.query.itemsPerPage) || 3
  const skip = currentPage * itemsPerPage
  const status = { status: "approve" }
  const result = await classCollention.find(status).skip(skip).limit(itemsPerPage).toArray()
  res.send(result)
})
// ----------------- get class by id for showing class details--------------
app.get('/classDetails/:id', async (req, res) => {
  const id = req.params.id
  console.log(id)
  const query = { _id: new ObjectId(id) }
  const result = await classCollention.findOne(query)
  res.send(result)
})
//-------------------- get class by won instructor ---------------------------
app.get('/class/:email', async (req, res) => {
  const email = req.params.email
  console.log(email)
  const query = { instructorEmail: email }
  const result = await classCollention.find(query).toArray()
  res.send(result)
})
// delete class from my class route in dashbord
app.delete('/removeClas/:id', async (req, res) => {
  const id = req.params.id
  const query = { _id: new ObjectId(id) }
  const result = await classCollention.deleteOne(query)
  res.send(result)
})
// -----------------add class feedback ------------------------
app.patch('/class/feedback/:id', async (req, res) => {
  const id = req.params.id
  const body = req.body
  console.log(id, body)
  const filter = { _id: new ObjectId(id) }
  const updateDoc = {
    $set: {
      feedback: body.feedback,
    }
  }
  const result = await classCollention.updateOne(filter, updateDoc)
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

app.put('/updateClas/:id', async (req, res) => {
  const updateClas = req.body
  const id = req.params.id
  const filter = { _id: new ObjectId(id) }
  const options = { upsert: true };
  console.log(updateClas)
  const updateDoc = {
    $set: {
      className: updateClas.className,
      price: updateClas.price,
      sets: updateClas.sets,
      classPhoto: updateClas.classPhoto,
      duration: updateClas.duration,
      enrollEndDate: updateClas.enrollEndDate,
      enrollStartDate: updateClas.enrollEndDate,
      classType: updateClas.classType
    },
  };
  const result = await classCollention.updateOne(filter, updateDoc, options)
  res.send(result)
})

//-------------------- admin home--------------------
// ------------------- totall ------------------
/* app.get('/totalluser', async (req, res) => {
  const totaluser = await usersCollection.estimatedDocumentCount()
  res.send({ totaluser: totaluser })
})

// ------------------- totall Class ------------------
app.get('/totallClass', async (req, res) => {
  const totallClass = await classCollention.estimatedDocumentCount()
  res.send({ totallClass: totallClass })
})

// ------------------- totall Class ------------------
app.get('/totallEnrolled', async (req, res) => {
  const totallEnroll = await enrolledClassCollection.estimatedDocumentCount()
  res.send({ totallEnroll: totallEnroll })
})

// -------------------- totall sales -----------------
app.get('/totalSales', async (req, res) => {
  const totalSales = await enrolledClassCollection.aggregate([
    {
      $group: {
        _id: null,
        totalPrice: { $sum: { $toDouble: '$price' } } // Convert price to a number if it's stored as a string
      }
    }
  ]).toArray()
  res.send({ totalSales: totalSales[0].totalPrice })
}) */

app.get('/total', async (req, res) => {
  const totallClass = await classCollention.estimatedDocumentCount()
  const totallEnroll = await enrolledClassCollection.estimatedDocumentCount()
  const totaluser = await usersCollection.estimatedDocumentCount()
  const totalPrice = await enrolledClassCollection.aggregate([
    {
      $group: {
        _id: null,
        totalPrice: { $sum: { $toDouble: '$price' } } // Convert price to a number if it's stored as a string
      }
    }
  ]).toArray()
  const totalSales = totalPrice[0].totalPrice
  res.send({ totallClass, totallEnroll, totaluser, totalSales })
})

//-------------- last register-----------
app.get('/lastJoinUser', verifyJWT, verifyAdmin, async (req, res) => {
  const result = await usersCollection.find().sort({ whenYouRegister: 1 }).limit(5).toArray()
  res.send(result)
})

// ----------last enrolled ------------
app.get('/lastEnroled', verifyJWT, verifyAdmin, async (req, res) => {
  const result = await enrolledClassCollection.find().sort({ date: -1 }).limit(5).toArray()
  res.send(result)
})


app.listen(port, () => {
  console.log('E_class server running')
})