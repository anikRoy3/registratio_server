const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const colors = require('colors')
const port = 5000
const cors = require('cors')
require('dotenv').config()

//middlewares
app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DATABASE_NAME}:${process.env.DATABASE_PASS}@cluster0.9ugfrbb.mongodb.net/?retryWrites=true&w=majority`;
console.log(process.env.DATABASE_PASS)
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
    console.log("successfully connected to MongoDB!".cyan);
    const userCollection = await client.db('mysoftheaven').collection('users')
    const productCollection = await client.db('mysoftheaven').collection('products')
    app.get(('/'), (req, res) => {
      res.send('hello everyone!!')
    })
    //post users
    app.post('/register', async (req, res) => {
      const { name, email, password, address, imageUrl, phone } = req.body;
      console.log(req.body)
      // Assuming the input data is already validated before reaching this point
      const newUser = {
        name,
        email,
        password,
        address,
        imageUrl,
        phone
      };
      const user = await userCollection.findOne({
        email
      });
      if (user) {
        return res.status(300).json({
          message: 'Failed to insert user, User already exists!!',
          status: 300
        })
      }
      const insertedUser = await userCollection.insertOne(newUser)
      if (insertedUser) {
        return res.status(200).json({
          message: 'User inserted successfully!!',
          status: 200,
          data: insertedUser
        })
      }
      return res.status(500).json({
        message: 'User inserted Failed!!',
        status: 500
      })
    });

    app.get('/user/:id', async (req, res) => {
      try {
        const id = req.params.id;
        console.log(id)
        const objectId = new ObjectId(id);

        const user = await userCollection.findOne({ _id: objectId });

        if (user) {
          return res.status(200).json({
            message: 'User retrieved successfully!',
            status: 200,
            user: user
          });
        } else {
          return res.status(404).json({
            message: 'User not found!',
            status: 404
          });
        }
      } catch (error) {
        return res.status(300).json({
          message: 'Failed to get user',
          status: 300
        });
      }
    });


    //update user
    app.put('/user/:id', async (req, res) => {
      const { id } = req.params;
      const { name, address, phone } = req.body;
      console.log(name, address, id)
      try {
        const user = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { name, address, phone } }
        );
        console.log(user)
          
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'User updated successfully', user });
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
      }
    });

    app.post('/login', async (req, res) => {
      const { email, password } = req.body
      const user = await userCollection.findOne({ email })
      console.log(user, 'login user')
      if (user) {
        const isValidPassword = user.password === password
        if (isValidPassword) {
          res.status(200).json({
            message: 'User get successfully!!',
            status: 200,
            data: user
          })
        } else {
          res.status(500).json({
            message: 'Invalid email or password',
            status: 300,
          })
        }
      } else {
        res.status(500).json({
          message: 'Invalid email or password',
          status: 300,
        })
      }
    })



    //products crud

    // Create a new product
    app.post('/products', async (req, res) => {
      try {
        const { name, price, description, image } = req.body;

        if (!name || !price || !description || !image) {
          return res.status(400).json({ message: 'Please provide name, price, iamge and description for the product' });
        }

        const newProduct = { name, price, description, image };

        const data = await productCollection.insertOne(newProduct);
        return res.status(201).json({ message: 'Product created successfully', product: data, status: 200 });
      } catch (error) {
        return res.status(400).json({ message: 'Product created Failed', status: 400, message: error.message });
      }

    });

    // Get all products
    app.get('/products', async (req, res) => {
      try {
        const productsCursor = await productCollection.find({}).toArray(); // Convert cursor to array
        return res.status(200).json({ message: 'Product Get successfully', data: productsCursor, status: 200 });
      } catch (error) {
        return res.status(400).json({ message: 'Product Get Failed', status: 400, error: error.message });
      }
    });


    // Get a specific product by ID
    app.get('/products/:id', async (req, res) => {
      try {
        const productId = req.params.id;
        const objectId = new ObjectId(productId);
        const product = await productCollection.findOne({ _id: objectId });
        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        } else {
          return res.status(200).json({ message: 'Product found successfully', status: 200, data: product });

        }
      } catch (error) {
        return res.status(400).json({ message: 'Product Get Failed by id', status: 400, message: error.message });
      }
    });

    // Update a product by ID
    app.put('/products/:id', async (req, res) => {
      const productId = req.params.id;
      const { name, price, description, image } = req.body;

      try {

        const result = await productCollection.updateOne(
          { _id: new ObjectId(productId) },
          { $set: { name, price, description, image } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Product not found for update!!" });

        }

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: 'Nothing to update', data: result });
        }

        return res.status(200).json({ message: 'Product updated successfully', data: result });
      } catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({ message: 'Failed to update product', error: error.message });
      }
    });

    // Delete a product by ID
    app.delete('/products/:id', async (req, res) => {
      const productId = req.params.id;

      try {
        const result = await productCollection.deleteOne({ _id: new ObjectId(productId) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json({ message: 'Product deleted successfully', data: result });
      } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ message: 'Failed to delete product', error: error.message });
      }
    });

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Registration app listening on port ${port}`.bgMagenta)
})





































