import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import chalk from "chalk";
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db = null;

const app = express();
app.use(express.json());
app.use(cors());

app.get("/participants", async (req, res) => {
  try {
    await mongoClient.connect();
    db = mongoClient.db("projeto_12_UOL");

    const participantsList = await db.collection("participants").find({}).toArray();
    res.status(200).send(participantsList);
    mongoClient.close();
  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
    mongoClient.close();
  }
})


app.listen(5000, () => console.log(chalk.blue.bold("Server ON")));

