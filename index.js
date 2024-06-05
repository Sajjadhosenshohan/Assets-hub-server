require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 7000;

const corsOptions = {
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        // "https://job-word.firebaseapp.com",
        // "https://job-word.web.app"
    ],
    credentials: true,
}
// middleware
app.use(cors(corsOptions));
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ejfr6xk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const usersCollection = client.db("myAssets").collection("users");
        const assetsCollection = client.db("myAssets").collection("assets");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }
        // user rest api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }

            const isAvailable = await usersCollection.findOne(query)
            if (isAvailable) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        });

        // Get Users
        app.get("/users", async (request, response) => {
            const result = await usersCollection.find().toArray();
            response.send(result);
        });

        // Get Users by email
        // app.get("/userData/:email", async (req, res) => {
        //     const email = req.params.email;
        //     const query = { email: email }
        //     const result = await usersCollection.findOne(query)
        //     res.send(result);
        // });

        // HR verify full obj User
        app.get("/usersCheck/:email", verifyToken, async (request, response) => {
            const email = request.params.email;

            // Ensure the email from the token matches the requested email
            if (email !== request.decoded.email) {
                return response.status(403).send({ message: "unauthorized" });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let hr = false;

            // Check if the user exists and if their role is 'hr'
            if (user.email && user.role === "hr") {
                hr = user;
            }

            // console.log(hr);
            response.send(hr);
        });

        // employee verify full obj User
        app.get("/usersCheckEmployee/:email", verifyToken, async (request, response) => {
            const email = request.params.email;

            // Ensure the email from the token matches the requested email
            if (email !== request.decoded.email) {
                return response.status(403).send({ message: "unauthorized" });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let employee = false;

            // Check if the user exists and if their role is 'employee'
            if (user.email && user.role === "employee") {
                employee = user;
            }
            // console.log(hr);
            response.send(employee);
        });


        // HR User
        app.get("/users/hr/:email", verifyToken, async (request, response) => {
            const email = request.params.email;
            if (email !== request.decoded.email) {
                return response.status(403).send({ message: "unauthorized" });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let hr = false;
            if (user) {
                hr = user?.role === "hr";
            }
            response.send({ hr });
        });
        // Employee User
        app.get("/users/employee/:email", verifyToken, async (request, response) => {
            const email = request.params.email;
            if (email !== request.decoded.email) {
                return response.status(403).send({ message: "unauthorized" });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let employee = false;
            if (user) {
                employee = user?.role === "employee";
            }
            response.send({ employee });
        });

        // add assets
        app.post('/addAssets', async (req, res) => {
            const add = req.body;
            const result = await assetsCollection.insertOne(add)
            res.send(result)
        })
        // get Assets list
        app.get("/assets", async (req, res) => {
            const result = await assetsCollection.find().toArray()
            res.send(result)
        })

        // get Assets list
        app.get("/assetOne/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assetsCollection.findOne(query)
            res.send(result)
        })
        // find my assets by email
        // get Assets list
        app.get("/assetByEmail/:email", async (req, res) => {
            const email = req.params.email;
            const query = { requesterEmail: email }
            const result = await assetsCollection.find(query).toArray()
            res.send(result)
        })

        //  Asset delete
        app.delete("/asset/delete/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assetsCollection.deleteOne(query)
            res.send(result)
        })

        //  Asset update
        app.patch("/update/:id", async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    product_name: item.product_name,
                    product_quantity: item.product_quantity,
                    product_type: item.product_type,
                    date_added: item.date_added,
                }
            }
            const result = await assetsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // Add An User To the Company
        app.patch("/users/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            // console.log(data)
            const { companyName, companyLogo, affiliate, Added_By } = req.body;

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    companyName,
                    companyLogo,
                    affiliate,
                    Added_By
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Remove An User From the Company
        app.patch("/usersRemove/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $unset: {
                    companyName: "",
                    companyLogo: "",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // my employee
        app.get("/users/company/:companyName", async (request, response) => {
            const companyName = request.params.companyName;

            // Ensure the user is authenticated
            // if (!request.decoded || !request.decoded.email) {
            //     return response.status(403).send({ message: "unauthorized" });
            // }

            // Retrieve users from the specified company
            const companyQuery = { companyName: companyName };
            const employees = await usersCollection.find(companyQuery).toArray();

            response.send(employees);
        });

        //  Asset update
        app.put("/assets/:id", async (req, res) => {
            const item = req.body;
            const { requestDate, requesterName, requesterEmail, notes } = item
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...item,
                    requestDate,
                    requesterEmail,
                    requesterName,
                    notes
                }
            }
            const result = await assetsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // all request by us status
        // get Assets list
        app.get("/allRequest/:email", async (req, res) => {
            const email = req.params.email;
            const query = { requesterEmail: email }
            const result = await assetsCollection.find(query).toArray()
            res.send(result)
        })

        // all request
        app.get("/allRequestByEmail/:email", verifyToken, async (request, response) => {
            const email = request.params.email;

            if (email !== request.decoded.email) {
                return response.status(403).send({ message: "unauthorized" });
            }
            const query = { Item_Added_By: email };
            // console.log(query)
            const allRequests = await assetsCollection.find(query).toArray();
            response.send(allRequests);
        });
        




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("my assets is running")
})

app.listen(port, () => {
    console.log(`My assets is running on port ${port}`);
})