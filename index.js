const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

//* middlewares
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

//* mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mt8kgrw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//* validate jwt
const verifyJWT = (req, res, next) => {
  try {
    const { authorization } = req.headers;
    if (!authorization) {
      return res
        .status(401)
        .send({ success: false, message: "Unauthorized access" });
    }

    //* access bearer token
    const token = authorization.split(" ")[1];
    if (!token) {
      throw new Error("Token missing in decoded JWT!");
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .send({ success: false, message: "Unauthorized access" });
      }

      req.decoded = decoded;
      next();
    });
  } catch (error) {
    return res
      .status(401)
      .send({ success: false, message: "Unauthorized access" });
  }
};

async function run() {
  try {
    const usersCollection = client.db("artistryAcademiaDB").collection("users");
    const classCollection = client
      .db("artistryAcademiaDB")
      .collection("classes");
    const instructorBioCollection = client
      .db("artistryAcademiaDB")
      .collection("instructorBio");
    const selectClassCollection = client
      .db("artistryAcademiaDB")
      .collection("selectClasses");
    const paymentClassCollection = client
      .db("artistryAcademiaDB")
      .collection("paymentClasses");

    //* Generate jwt token !TODO: change jwt expiry
    app.post("/jwt", async (req, res) => {
      try {
        const email = req.body;
        const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "30d",
        });

        res.send({ token });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* verify admin
    const verifyAdmin = async (req, res, next) => {
      try {
        const { email } = req.decoded;
        if (!email) {
          throw new Error("Email is missing in decoded !");
        }

        const user = await usersCollection.findOne({ email: email });
        if (!user) {
          throw new Error("User not found");
        }

        if (user?.role !== "admin") {
          return res.status(403).send({
            success: false,
            message: "Forbidden message! You are not admin!",
          });
        }
        next();
      } catch (error) {
        return res.status(403).send({
          success: false,
          message: "Forbidden! You are not an admin!",
        });
      }
    };

    //* verify instructor
    const verifyInstructors = async (req, res, next) => {
      try {
        const email = req.decoded.email;
        if (!email) {
          throw new Error("Email is missing in decoded !");
        }

        const user = await usersCollection.findOne({ email: email });
        if (!user) {
          throw new Error("User not found");
        }

        if (user?.role !== "instructor") {
          return res.status(403).send({
            success: false,
            message: "Forbidden message! You are not instructor!",
          });
        }
        next();
      } catch (error) {
        return res.status(403).send({
          success: false,
          message: "Forbidden! You are not an instructor!",
        });
      }
    };

    //* verify student
    const verifyStudents = async (req, res, next) => {
      try {
        const email = req.decoded.email;
        if (!email) {
          throw new Error("Email is missing in decoded !");
        }

        const user = await usersCollection.findOne({ email: email });
        if (!user) {
          throw new Error("User not found");
        }

        if (user?.role !== "student") {
          return res.status(403).send({
            success: false,
            message: "Forbidden message! You are not student!",
          });
        }
        next();
      } catch (error) {
        return res.status(403).send({
          success: false,
          message: "Forbidden! You are not an student!",
        });
      }
    };

    //? ********** USER RELATE APIS **********/

    //* get all users to db
    app.get("/users", verifyJWT, async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        if (!users) {
          throw new Error("User not found here!");
        }
        const totalData = await usersCollection.countDocuments();

        res.send({
          success: true,
          message: "Get all users retrieve successfully!",
          totalData: totalData,
          data: users,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get a user by to db
    app.get("/user/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const filter = { _id: new ObjectId(id) };

        const user = await usersCollection.findOne(filter);
        if (!user) {
          throw new Error("User not found here!");
        }

        res.send({
          success: true,
          message: "Get a user retrieve successfully!",
          data: user,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get all instructor
    app.get("/instructors", async (req, res) => {
      try {
        const instructors = await usersCollection
          .find({ role: "instructor" })
          .toArray();
        if (!instructors) {
          throw new Error("Instructors not found here!");
        }
        const totalData = await usersCollection.countDocuments({
          role: "instructor",
        });

        res.send({
          success: true,
          message: "Get all instructors retrieve successfully!",
          totalData: totalData,
          data: instructors,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get all students
    app.get("/students", verifyJWT, async (req, res) => {
      try {
        const students = await usersCollection
          .find({ role: "student" })
          .toArray();
        if (!students) {
          throw new Error("Students not found here!");
        }
        const totalData = await usersCollection.countDocuments({
          role: "student",
        });

        res.send({
          success: true,
          message: "Get all students retrieve successfully!",
          totalData: totalData,
          data: students,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* Get user by email
    app.get("/users/:email", verifyJWT, async (req, res) => {
      try {
        const { email } = req.params;

        const user = await usersCollection.findOne({ email: email });
        if (!user) {
          throw new Error("User not found here!");
        }

        res.send({
          success: true,
          message: "Get a user retrieve successfully!",
          data: user,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* save user in DB
    app.put("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const user = req.body;

        const saveUser = await usersCollection.updateOne(
          { email: email },
          {
            $set: user,
          },
          { upsert: true }
        );

        res.send(saveUser);
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* make admin
    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };

        const result = await usersCollection.updateOne(filter, updateDoc);

        res.send({
          success: true,
          message: "Make admin successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get admin and secure route
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      try {
        const { email } = req.params;
        if (req.decoded.email !== email) {
          res.send({ admin: false });
        }

        const user = await usersCollection.findOne({ email: email });
        if (!user) {
          return res.send({ admin: false });
        }

        const result = { admin: user?.role === "admin" };

        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* make Instructor
    app.patch(
      "/users/instructor/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          if (!id || !ObjectId.isValid(id)) {
            throw new Error("Invalid or missing id parameter");
          }

          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: {
              role: "instructor",
            },
          };

          const result = await usersCollection.updateOne(filter, updateDoc);

          res.send({
            success: true,
            message: "Make a instructor successfully!",
            data: result,
          });
        } catch (error) {
          res
            .status(500)
            .send({ success: false, message: "Internal server error" });
        }
      }
    );

    //* get instructor and secure route
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      try {
        const { email } = req.params;
        if (req.decoded.email !== email) {
          res.send({ instructor: false });
        }

        const user = await usersCollection.findOne({ email: email });
        if (!user) {
          return res.send({ instructor: false });
        }

        const result = { instructor: user?.role === "instructor" };

        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* Update user by email in DB
    app.put("/user/:email", verifyJWT, async (req, res) => {
      try {
        const { email } = req.params;
        const user = req.body;

        const result = await usersCollection.updateOne(
          { email: email },
          {
            $set: user,
          },
          { upsert: true }
        );

        res.send({
          success: true,
          message: "Update a user successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* delete a user from db
    app.delete("/user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { isDeleted: true },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);

        res.send({
          success: true,
          message: "Delete a user successfully!",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ error: true, message: "Internal server error" });
      }
    });

    //? *********** INSTRUCTOR BIO RELATED APIS *************/

    //* save instructors bio and change user role to instructor in db
    app.post("/save-instructor-bio", verifyJWT, async (req, res) => {
      try {
        const bioData = req.body;
        const { user: userId } = bioData;
        if (!userId || !ObjectId.isValid(userId)) {
          throw new Error("Invalid or missing userId parameter");
        }

        const filter = { _id: new ObjectId(userId) };
        const updateDoc = {
          $set: {
            role: "instructor",
          },
        };

        const saveBio = await instructorBioCollection.insertOne(bioData);
        const updateUser = await usersCollection.updateOne(filter, updateDoc);

        res.send({
          success: true,
          message: "Add instructor bio and get instructor successfully!",
          saveBio: saveBio,
          updateUser: updateUser,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get instructors bio by userId
    app.get("/get-instructor-bio/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const bio = await instructorBioCollection.findOne({ user: id });
        if (!bio) {
          throw new Error("This instructors bio dose not found");
        }

        res.send({
          success: true,
          message: "Get a instructor bio successfully!",
          data: bio,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //? *********** CLASS RELATE APIS *************/

    //* save class in Database
    app.post("/class", verifyJWT, verifyInstructors, async (req, res) => {
      try {
        const classData = req.body;

        const saveClass = await classCollection.insertOne(classData);
        if (!saveClass) {
          throw new Error("Class is not save in database yet!");
        }

        res.send({
          success: true,
          message: "Save in course successfully!",
          data: saveClass,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get all class to db
    app.get("/classes", verifyJWT, async (req, res) => {
      try {
        const classes = await classCollection.find().toArray();
        if (!classes) {
          throw new Error("Class not found !");
        }
        const totalData = await classCollection.countDocuments();

        res.send({
          success: true,
          message: "Get all course successfully!",
          totalData: totalData,
          data: classes,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get a class to db
    app.get("/classes/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const filter = { _id: new ObjectId(id) };
        const classes = await classCollection.findOne(filter);
        if (!classes) {
          throw new Error("Class is not found !");
        }

        res.send({
          success: true,
          message: "Get a course successfully!",
          data: classes,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get all approve class to db
    app.get("/approve-class", async (req, res) => {
      try {
        const result = await classCollection
          .find({ status: "approved" }).sort({ enrolledCourse: -1 })
          .toArray();
        if (!result) {
          throw new Error("Approved class not found !");
        }

        const totalData = await classCollection.countDocuments({
          status: "approved",
        });

        res.send({
          success: true,
          message: "All course retrieved successfully!",
          totalData: totalData,
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get all class by email instructor
    app.get("/my-class", verifyJWT, async (req, res) => {
      try {
        const { email } = req.query;

        const result = await classCollection
          .find({ "instructor.email": email })
          .toArray();
        if (!result || result.length === 0) {
          return res.status(404).send({
            success: false,
            message: "No classes found for the provided email",
          });
        }

        const totalData = await classCollection.countDocuments({
          "instructor.email": email,
        });

        res.status(200).send({
          success: true,
          message: "Classes retrieved successfully",
          totalData: totalData,
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* Update A class by instructor
    app.patch(
      "/update-class/:id",
      verifyJWT,
      verifyInstructors,
      async (req, res) => {
        try {
          const classData = req.body;

          const { id } = req.params;
          if (!id || !ObjectId.isValid(id)) {
            throw new Error("Invalid or missing id parameter");
          }

          const filter = { _id: new ObjectId(id) };
          const options = { upsert: true };
          const updateDoc = {
            $set: classData,
          };
          const result = await classCollection.updateOne(
            filter,
            updateDoc,
            options
          );

          res.status(200).send({
            success: true,
            message: "Instructors update a course successfully!",
            data: result,
          });
        } catch (error) {
          res
            .status(500)
            .send({ success: false, message: "Internal server error" });
        }
      }
    );

    //* Give feedback A class by admin feed message
    app.patch("/class/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const feedback = req.body;

        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: feedback,
        };
        const result = await classCollection.updateOne(
          filter,
          updateDoc,
          options
        );

        res.status(200).send({
          success: true,
          message: "Give feedback a course successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* approve class by admin
    app.patch(
      "/classes/approved/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          if (!id || !ObjectId.isValid(id)) {
            throw new Error("Invalid or missing id parameter");
          }

          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: {
              status: "approved",
            },
          };

          const result = await classCollection.updateOne(filter, updateDoc);

          res.status(200).send({
            success: true,
            message: "Approve a course by admin successfully!",
            data: result,
          });
        } catch (error) {
          res
            .status(500)
            .send({ success: false, message: "Internal server error" });
        }
      }
    );

    //* Deny class by admin
    app.patch("/classes/deny/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "deny",
          },
        };

        const result = await classCollection.updateOne(filter, updateDoc);

        res.status(200).send({
          success: true,
          message: "Deny a course by admin successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* delete class from database
    app.delete("/delete-class/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id || !ObjectId.isValid(id)) {
          throw new Error("Invalid or missing id parameter");
        }

        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { isDeleted: true },
        };
        const result = await classCollection.updateOne(query, updateDoc);

        res.status(200).send({
          success: true,
          message: "Delete a course successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //? *********** SELECT CLASS RELATE APIS *************/

    //* get all selected class by student email
    app.get("/selected-class", verifyJWT, verifyStudents, async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          res.send([]);
        }

        const decodedEmail = req.decoded.email;
        if (email !== decodedEmail) {
          return res
            .status(403)
            .send({ success: false, message: "Forbidden access" });
        }

        const result = await selectClassCollection
          .find({ "studentInfo.email": email })
          .toArray();

        res.status(200).send({
          success: true,
          message: "Student course retrieved successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* save (select) class by student
    app.post("/select-class", verifyJWT, verifyStudents, async (req, res) => {
      try {
        const classData = req.body;

        const result = await selectClassCollection.insertOne(classData);
        if (!result) {
          throw new Error("Select to class failed !");
        }

        res.status(200).send({
          success: true,
          message: "Select course by student successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* delete select class by student
    app.delete(
      "/select-class/:id",
      verifyJWT,
      verifyStudents,
      async (req, res) => {
        try {
          const { id } = req.params;
          if (!id || !ObjectId.isValid(id)) {
            throw new Error("Invalid or missing id parameter");
          }

          const query = { _id: new ObjectId(id) };
          const result = await selectClassCollection.deleteOne(query);

          res.status(200).send({
            success: true,
            message: "Delete to select course successfully!",
            data: result,
          });
        } catch (error) {
          res
            .status(500)
            .send({ success: false, message: "Internal server error" });
        }
      }
    );

    //? ************ ENROLL CLASS RELATED APIS **********/

    //* get student all enroll class by email
    app.get("/enroll-class", verifyJWT, verifyStudents, async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          res.send([]);
        }

        const result = await paymentClassCollection
          .find({ "studentInfo.email": email })
          .sort({ date: -1 })
          .toArray();

        res.status(200).send({
          success: true,
          message: "Get student enrolled course retrieved successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* get all enroll class in db
    app.get("/all-enroll-class", verifyJWT, async (req, res) => {
      try {
        const result = await paymentClassCollection
          .find()
          .sort({ date: -1 })
          .toArray();

        res.status(200).send({
          success: true,
          message: "Get all enrolled course retrieved successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //? ********** PAYMENT RELATED APIS ***********/

    //* save payment class data to database
    app.post("/payment-class", async (req, res) => {
      try {
        const classData = req.body;
        const { classInfo } = req.body;
        const course = classInfo._id;

        const filter = { _id: new ObjectId(course) };
        const classes = await classCollection.findOne(filter);
        if (!classes) {
          throw new Error("Class is not found !");
        }

        const update = {
          $inc: {
            seats: -1,
            enrolledCourse: 1,
          },
        };

        const updateCourse = await classCollection.updateOne(filter, update);
        if (!updateCourse || updateCourse.modifiedCount === 0) {
          throw new Error("Failed to update class details !");
        }

        const result = await paymentClassCollection.insertOne(classData);

        const query = { _id: new ObjectId(classData._id) };
        const deleteResult = await selectClassCollection.deleteOne(query);

        res.status(200).send({
          success: true,
          message: "Payment a course successfully!",
          data: result,
          updateResult: updateCourse,
          deleteResult: deleteResult,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //* create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      try {
        const { price } = req.body;
        const amount = parseInt(price * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Artistry Academia Server is running....!");
});

app.listen(port, () => {
  console.log(`Artistry Academia is listening on port ${port}`);
});
