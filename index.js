const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000
const app = express()
// middleWare
app.use(cors())
app.use(express.json())


app.get('/', (req, res) => {
    res.send('summer camp school')
})

app.listen(port, () => {
    console.log('summer camp server running')
})