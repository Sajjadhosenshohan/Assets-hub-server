require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
// This is your test secret API key.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
        const paymentCollection = client.db("myAssets").collection("payments");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
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

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req?.decoded.email;

            console.log("admin or not", email)
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            console.log(user, "user ace ki")
            const isAdmin = user?.role === 'hr';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
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
        app.get("/users", verifyToken, verifyAdmin, async (request, response) => {
            const result = await usersCollection.find().toArray();
            response.send(result);
        });

        // Get all Employee and add
        app.get("/get_all_employee",verifyToken,verifyAdmin, async (req, res) => {
            const page = parseInt(req.params.page) || 0;
            const size = parseInt(req.params.size) || 10;

            const count = await assetsCollection.countDocuments();
            const usersWithoutCompanyName = await usersCollection.find({
                companyName: null
            }).skip(page * size).limit(size).toArray();

            res.send({
                AddEmployee: usersWithoutCompanyName,
                count: count
            });
        });

        // Get Users
        app.patch("/users_update/:email",verifyToken, async (req, res) => {
            const email = req.params.email;
            const item = req.body;
            console.log(item)
            const query = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: item.name
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.send(result)
        });

        
        // HR verify full obj User
        app.get("/usersCheck/:email",verifyToken, async (request, response) => {
            const email = request.params.email;

            // Ensure the email from the token matches the requested email
            if (email !== request.decoded.email) {
                return response.status(403).send({ message: "unauthorized" });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            // console.log(user)
            let hr = false;

            // Check if the user exists and if their role is 'hr'
            if (user?.email && user?.role === "hr") {
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
            if (user?.email && user?.role === "employee") {
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

        // add assets and jwt applied
        app.post('/addAssets',verifyToken,verifyAdmin, async (req, res) => {
            const add = req.body;
            const result = await assetsCollection.insertOne(add)
            res.send(result)
        })

        // add assets
        app.post('/addAssetsByEmployee',verifyToken, async (req, res) => {
            const add = req.body;
            const result = await assetsCollection.insertOne(add)
            res.send(result)
        })

        // get Assets list jwt problem
        app.get("/assets_get",verifyToken,async (req, res) => {
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;
            const search = req.query.search || "";
            const availabilityCheck = req.query.availabilityCheck || "";
            console.log(page, size, search, availabilityCheck)
            const query = {
                product_name: { $regex: search, $options: "i" }
            };

            if (availabilityCheck) {
                if (availabilityCheck === "available" || availabilityCheck === "out_of_stock") {
                    query.availability = availabilityCheck;
                } else if (availabilityCheck === "Returnable" || availabilityCheck === "Non-returnable") {
                    query.product_type = availabilityCheck;
                }
            }

            try {
                const allAssets = await assetsCollection.find(query).skip(page * size).limit(size).toArray();
                const count = await assetsCollection.countDocuments(query);
                res.send({
                    allAssets: allAssets,
                    count: count
                });
            } catch (error) {
                console.error("Error fetching assets:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // all assets
        app.get("/all_assets", async (req, res) => {
            const result = await assetsCollection.find().toArray()
            res.send(result)
        })


        // get Assets list
        app.get("/assetOne/:id",verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assetsCollection.findOne(query)
            res.send(result)
        })

        // my requested assets requested
        app.get("/assetByEmail/:email",verifyToken, async (req, res) => {
            // 
            const email = req.params.email;
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;
            const search = req.query.search || "";
            const availabilityCheck = req.query.availabilityCheck || "";
            console.log(page, size, search, availabilityCheck)
            // Constructing the query based on search and availability filter
            const query = {
                requesterEmail: email,
                product_name: { $regex: search, $options: "i" }
            };

            // Adding availability filter if available in the query parameters
            if (availabilityCheck) {
                if (availabilityCheck === "pending" || availabilityCheck === "approved") {
                    query.status = availabilityCheck;
                } else if (availabilityCheck === "Returnable" || availabilityCheck === "Non-returnable") {
                    query.product_type = availabilityCheck;
                }
            }

            // Fetching assets based on the constructed query
            const allAssets = await assetsCollection.find(query).skip(page * size).limit(size).toArray();

            // Counting total documents based on the query (without pagination)
            const count = await assetsCollection.countDocuments(query);

            res.send({
                assetByEmail: allAssets,
                count: count
            });
        })

        // my pending request for home
        app.get("/myPendingRequest/:email",verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = {
                requesterEmail: email,
                status: "pending"
            };
            const result = await assetsCollection.find(query).toArray()
            res.send(result);
        })
        //  jwt problem
        // my assets by email for assets list hr page
        app.get("/all_assets/:email",verifyToken,verifyAdmin,  async (req, res) => {
            const email = req.params.email;

            // check admin/hr
            // if (email !== req.decoded.email) {
            //     return response.status(403).send({ message: "unauthorized" });
            // }

            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;

            const search = req.query.search || "";
            const availabilityCheck = req.query.availabilityCheck || "";

            const sortField = req.query.sortField || "product_quantity";
            const sortOrder = parseInt(req.query.sortOrder) || 1;

            const query = {
                Item_Added_By: email,
                product_name: { $regex: search, $options: "i" }
            };

            if (availabilityCheck) {
                if (availabilityCheck === "available" || availabilityCheck === "out_of_stock") {
                    query.availability = availabilityCheck;
                } else if (availabilityCheck === "Returnable" || availabilityCheck === "Non-returnable") {
                    query.product_type = availabilityCheck;
                }
            }
            const allAssets = await assetsCollection.find(query).sort({ [sortField]: sortOrder })
                .skip(page * size)
                .limit(size)
                .toArray();

            const count = await assetsCollection.countDocuments(query);

            res.send({
                assets: allAssets,
                count: count
            });
        })

        //  Asset delete
        app.delete("/asset/delete/:id",verifyToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assetsCollection.deleteOne(query)
            res.send(result)
        })

        //  Asset update by id
        app.patch("/update/:id",verifyToken,verifyAdmin, async (req, res) => {
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
        app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
           
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
        app.patch("/usersRemove/:id",verifyToken,verifyAdmin, async (req, res) => {
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
        app.get("/users/company/:companyName",verifyToken,verifyAdmin, async (req, res) => {
            const companyName = req.params.companyName;

            const page = parseInt(req.params.page) || 0;
            const size = parseInt(req.params.size) || 10;
            
            console.log(page, size, companyName)


            // Find users where companyName field does not exist or is null
            const usersWithoutCompanyName = await usersCollection.find({ companyName }).skip(page * size).limit(size).toArray();

            // Counting total documents based on the query (without pagination)
            const count = await usersCollection.countDocuments();

            res.send({
                myEmployee: usersWithoutCompanyName,
                count: count
            });
        });

        // my employee
        app.get("/users_company/:companyName",verifyToken, async (req, res) => {
            const companyName = req.params.companyName;
            console.log(companyName)
            // Ensure the user is authenticated
            // if (!request.decoded || !request.decoded.email) {
            //     return response.status(403).send({ message: "unauthorized" });
            // }
            const page = parseInt(req.params.page) || 0;
            const size = parseInt(req.params.size) || 10;
            console.log(456, page, size, companyName)


            // Find users where companyName field does not exist or is null
            const usersWithoutCompanyName = await usersCollection.find({ companyName: companyName }).skip(page * size).limit(size).toArray();

            // Counting total documents based on the query (without pagination)
            const count = await usersCollection.countDocuments();

            res.send({
                myTeam: usersWithoutCompanyName,
                count: count
            });
        });
        // Update or create asset
        app.put("/assets/:id",verifyToken, async (req, res) => {
            const item = req.body;
            const { requestDate, requesterName, requesterEmail, notes, companyName, companyLogo } = item;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    ...item,
                    requestDate,
                    requesterEmail,
                    requesterName,
                    notes,
                    companyName,
                    companyLogo
                }
            };
            try {
                const existingAsset = await assetsCollection.findOne(query);
                if (existingAsset) {
                    // Update existing asset
                    const result = await assetsCollection.updateOne(query, updateDoc);
                    res.json({ message: "Asset updated successfully", data: result });
                } else {
                    // Create new asset
                    const result = await assetsCollection.insertOne(item);
                    res.json({ message: "New asset created successfully", data: result });
                }
            } catch (error) {
                console.error('Error updating/creating asset', error);
                res.status(500).json({ message: "Internal server error" });
            }
        });

        // get Assets list
        app.get("/allRequest/:email", async (req, res) => {
            const email = req.params.email;
            const query = { requesterEmail: email }
            const result = await assetsCollection.find(query).toArray()
            res.send(result)
        })

        // all request by email
        app.get("/allRequestByEmail/:email", verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "unauthorized" });
            }
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;
            const query = { Item_Added_By: email };

            try {
                const allRequests = await assetsCollection.find(query).skip(page * size).limit(size).toArray();
                const allRequestCount = await assetsCollection.countDocuments(query);

                res.send({
                    requests: allRequests,
                    count: allRequestCount
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });


        // const count = await productCollection.estimatedDocumentCount();
        // asset reject
        app.patch("/asset_rejected/:id",verifyToken, async (req, res) => {
            // const item = req.body;
            const id = req.params.id;
            const { status } = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: "rejected",
                }
            }
            const result = await assetsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        //assets status make return 
        app.patch("/asset_returned/:id",verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: "returned"
                },
                $inc: {
                    product_quantity: 1
                }
            };
            const result = await assetsCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        //  Asset update and add jwt
        app.put("/asset_status_change/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const item = req.body;
            const { status, approvedDate } = item;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    ...item,
                    status,
                    approvedDate
                }
            }
            const result = await assetsCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })


        app.get('/requestsByEmail/:email',verifyToken, async (req, res) => {
            const { email } = req.params;
            const { month, year } = req.query;
            console.log(`Fetching requests for email: ${email}, month: ${month}, year: ${year}`)
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);

            console.log("Start Date:", startDate, "End Date:", endDate);

            try {
                await assetsCollection.find().forEach((doc) => {
                    if (typeof doc.requestDate === 'string') {
                        assetsCollection.updateOne(
                            { _id: doc._id },
                            { $set: { requestDate: new Date(doc.requestDate) } }
                        );
                    }
                });

                const requests = await assetsCollection.aggregate([
                    {
                        $match: {
                            requesterEmail: email,
                            requestDate: {
                                $gte: startDate,
                                $lt: endDate
                            }
                        }
                    }
                ]).toArray();
                console.log(requests);
                res.json(requests);
            } catch (error) {
                console.error('Error fetching requests', error);
                res.status(500).send('Error fetching requests');
            }
        });

        // payments
        app.post("/create-payment-intent", async (req, res) => {
            const { category_price } = req.body;
            // console.log(category_price)
            const amount = parseInt(category_price * 100)

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payments', verifyToken, verifyAdmin,  async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            res.send(paymentResult);
        })


        app.patch("/payments/change/:email", verifyToken, verifyAdmin,  async (req, res) => {
            const { category_price , payment} = req.body;
            const email = req.params.email;
            const query = { email: (email) }
            const updateDoc = {
                $set: {
                    category: parseInt(category_price),
                    payment:payment
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // _________________
        // get top 5 pending request
        app.get('/pending_req/:email',verifyToken,verifyAdmin,  async (req, res) => {
            const { email } = req.params;
            try {
                const pendingRequests = await assetsCollection.find({ status: 'pending', Item_Added_By: email }).limit(5).toArray();

                // console.log(pendingRequests)
                res.json(pendingRequests);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });

        // get Limited_stock_items
        app.get('/Limited_stock_items/:email',verifyToken,verifyAdmin, async (req, res) => {
            const { email } = req.params;
            try {
                const Limited_stock_items = await assetsCollection.find({ product_quantity: { $lt: 10 }, Item_Added_By: email }).limit(5).toArray();

                console.log(Limited_stock_items)
                res.json(Limited_stock_items);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });

        // Get top 4 most requested items for a specific HR email
        app.get('/top_requests/:email',verifyToken,verifyAdmin,  async (req, res) => {
            const { email } = req.params;
            try {
                const topRequestedItems = await assetsCollection.aggregate([
                    { $match: { Item_Added_By: email } },  // Filter by HR email
                    {
                        $group: {
                            _id: "$product_name",
                            requestCount: { $sum: 1 },
                            requesterEmail: { $first: "$requesterEmail" },
                            Item_Added_By: { $first: "$Item_Added_By" }
                        }
                    },
                    { $sort: { requestCount: -1 } },
                    {
                        $project: {
                            _id: 0,
                            product_name: "$_id",
                            requestCount: 1,
                            requesterEmail: 1,
                            Item_Added_By: 1
                        }
                    }

                ]).limit(4).toArray();
                res.json(topRequestedItems);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });

        // get all assets for pie_chart
        app.get("/Stats_chart/:email",verifyToken,verifyAdmin,  async (req, res) => {
            const email = req.params.email;
            const query = { Item_Added_By: email }
            const result = await assetsCollection.find(query).toArray()
            res.send(result)
        })


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