const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const colors = require('colors')
const port = 5000
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer")
const mg = require('nodemailer-mailgun-transport');



//middlewares
app.use(express.json())
app.use(cors())





const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
const is_live = false
const JWT_FP_SECRET = process.env.JWT_FP_SECRET

const uri = `mongodb+srv://${process.env.DATABASE_NAME}:${process.env.DATABASE_PASS}@cluster0.zkiyzka.mongodb.net/?retryWrites=true&w=majority`;
// const uri = 'mongodb://localhost:27017/mysoftheaven'

console.log(uri)

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
    const userCollection = client.db('mysoftheaven').collection('users')
    const productCollection = client.db('mysoftheaven').collection('products')
    const orderCollection = client.db('mysoftheaven').collection('orders')
    app.get(('/'), (req, res) => {
      res.send('hello everyone!!')
    })
    //post users
    app.post('/register', async (req, res) => {
      const { name, email, password, address, imageUrl, phone, role } = req.body;
      console.log(req.body)

      const newUser = {
        name,
        email,
        password,
        address,
        imageUrl,
        phone,
        role
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
      const { email, password } = req.body;
      console.log('email', email, password)
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
          res.status(300).json({
            message: 'Invalid email or password',
            status: 300,
          })
        }
      } else {
        res.status(300).json({
          message: 'Invalid email or password',
          status: 300,
        })
      }
    })



    //Forgot password
    app.post('/forgotPassword', async (req, res) => {
      try {
        const { email, way } = req.body;
        console.log('email from browser', email);

        const user = await userCollection.findOne({ email });
        if (!user) return res.status(400).json({ message: "Couldn't find user with this email", status: 400, email: email });
        console.log(user)
        const payload = {
          email: user.email,
          _id: user._id
        }
        const sercet = JWT_FP_SECRET + user.password;
        const token = jwt.sign(payload, sercet, { expiresIn: '15m' });
        const URL = `http://localhost:5000/resetPassword/${user._id}/${token}`
        console.log(process.env.TRANSPORTER_PASS, process.env.MAILGUN_API_KEY, process.env.MAILGUN_DOMAIN)
        const auth = {
          auth: {
            api_key: process.env.MAILGUN_API_KEY,
            domain: process.env.MAILGUN_DOMAIN
          }
        }
        const transporter = nodemailer.createTransport(mg(auth));
        const otp = Math.floor(1000 + Math.random() * 9000);
        let message = ''
        if (way === 'otp') {
          message = `<span>${otp}</span>`
        } else {
          message = `<a href=${URL}>For reset your password click here.</a>`
        }
        console.log(message)
        // const nodemailerMailgun =
        transporter.sendMail({
          from: 'anikkumerroy7@gmail.com',
          to: user.email,
          subject: 'Reset Password',
          html: message,
          text: 'Reset your password'
        }, (err, info) => {
          if (err) {
            console.log(`Error: ${err}`);
            return res.status(500).json({ message: "Error sending email", status: 500, error: err });
          }
          console.log(`Response: ${info}`);
          return res.status(200).json({ message: 'User found successfully', token, status: 200, data: user, mailInfo: info, otp: way === 'otp' ? otp : false });
        });

      } catch (error) {
        console.error(error);
        return res.status(400).json({ message: "Something went wrong!", status: 400, error: error.message });
      }
    });


    app.get('/resetPassword/:id/:token', async (req, res) => {
      try {
        const { id, token } = req.params
        console.log(req.params);
        const user = await userCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
          return res.status(400).json({ message: "Invaild userId", status: 400 })
        }
        const secret = JWT_FP_SECRET + user.password
        jwt.verify(token, secret, (err, decoded) => {
          if (err) {
            return res.json({ message: 'Invalid crediantial', error: err.message })
          } else {
            const { _id, email } = decoded
            const url = `http://localhost:5173/reset-password/${_id}`
            return res.redirect(url)
          }
        });
      } catch (error) {
        console.log(error.message);
        return res.json({ error: error.message })
      }
    })

    //reset password with update user 
    app.post('/resetPassword/:id', async (req, res) => {
      try {
        const { authorization } = req.headers;
        console.log(authorization)
        const token = authorization.split(' ')[1];
        console.log(token)
        const { id } = req.params;
        const { newPassword } = req.body;
        const user = await userCollection.findOne({ _id: new ObjectId(id) })
        const secret = process.env.JWT_FP_SECRET + user.password;
        jwt.verify(token, secret, async (err, decoded) => {
          if (err) {
            return res.json({ message: 'Failed to reset password', error: err.message })
          } else {
            console.log(decoded);
            const updatedUser = {
              ...user,
              password: newPassword
            }
            const updatedUserData = await userCollection.updateOne({ _id: new ObjectId(id) }, {
              $set: updatedUser
            });
            return res.json({ message: 'Password updated successfully', result: updatedUserData })
          }
        })
      } catch (error) {
        console.log(error.message)
        return res.json({ message: 'Something went wrong', error: error.message })
      }
    })


    // Create a new product
    app.post('/products', async (req, res) => {
      try {
        console.log(req.body)
        const { name, price, description, image, discount, quantity, category } = req.body;

        if (!name || !price || !description || !image || !quantity) {
          return res.status(400).json({ message: 'Please provide name, price, iamge and description for the product' });
        }
        const retings = Math.ceil(Math.random() * 5)
        const newProduct = { name, price, description, image, discount, quantity, category, retings };

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
      const { name, price, description, image, discount, quantity } = req.body;

      try {

        const result = await productCollection.updateOne(
          { _id: new ObjectId(productId) },
          { $set: { name, price, description, image, discount, quantity } }
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


    //create payment system 

    //sslcommerz init
    app.post('/order', async (req, res) => {
      const { name, totalPrice, email, currency, postcode, ship_country, address, phone, itemsQuantity } = req.body;
      console.log(req.body)
      const transactionId = new ObjectId().toString()
      const data = {
        total_amount: parseInt(totalPrice),
        currency: currency,
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `http://localhost:5000/order/success?transactionId=${transactionId}`,
        fail_url: 'http://localhost:3030/fail',
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: name,
        cus_email: email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: postcode,
        cus_country: ship_country,
        cus_phone: phone,
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: address,
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        const order = {
          email, name, totalPrice, transactionId, address, phone,
          paid: false, itemsQuantity
        }
        orderCollection.insertOne(order)
        res.send({ url: GatewayPageURL })
        console.log('Redirecting to: ', GatewayPageURL, apiResponse)
      });
    })

    app.post('/order/success', async (req, res) => {
      const { transactionId } = req.query;
      await orderCollection.updateOne({ transactionId }, {
        $set: {
          paid: true,
          paidAt: new Date()
        }
      })
      // console.log(transactionId)

      const order = await orderCollection.findOne({ transactionId })
      console.log(order)
      const orderedProducts = Object.keys(order.itemsQuantity);

      orderedProducts.forEach(async (id) => {
        console.log('updated ', id)
        const updatedProduct = await productCollection.findOne({ _id: new ObjectId(id) });
        console.log('updated  new', updatedProduct, 'dfdas', order.itemsQuantity[id])
        updatedProduct.quantity = updatedProduct.quantity - order.itemsQuantity[id];
        await productCollection.updateOne({ _id: new ObjectId(id) }, {
          $set: { ...updatedProduct }
        })
      })
      const url = `http://localhost:5173/payment/success?${transactionId}`
      res.redirect(url)
    })


    app.get('/myorder', async (req, res) => {
      try {
        const { email } = req.query;
        console.log(email)
        const order = await orderCollection.find({ email }).toArray();
        console.log(order)
        if (order) {
          return res.status(200).json({ message: "Order found successfully", order })
        }
        return res.status(300).json({ message: 'Failed to found the product' })
      } catch (error) {
        return res.status(300).json({ message: 'Failed to get order!!', error: error.message })
      }

    })


  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Registration app listening on port ${port}`.bgMagenta)
})





































