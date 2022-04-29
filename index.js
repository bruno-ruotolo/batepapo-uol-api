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

app.post("/participants", async (req, res) => {
  try {
    await mongoClient.connect();
    db = mongoClient.db("projeto_12_UOL");

    const participantName = req.body.name;
    await db.collection("participants").insertOne({
      name: participantName,
      lastStatus: Date.now()
    });
    await db.collection("messages").insertOne({
      from: participantName,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format("HH:mm:ss")
    });
    res.sendStatus(201);
    mongoClient.close();
  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
    mongoClient.close();
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const { limit } = req.query;
  try {
    await mongoClient.connect();
    db = mongoClient.db("projeto_12_UOL");

    if (limit) {
      const messagesList = await db.collection("messages").find({ $or: [{ to: user }, { to: "Todos" }] }).toArray();
      const messagesListSplice = [...messagesList].splice(0, parseInt(limit))
      res.status(200).send(messagesListSplice);
      return;
    }

    const messagesList = await db.collection("messages").find({ $or: [{ to: user }, { to: "Todos" }] }).toArray();
    res.status(200).send(messagesList);

    mongoClient.close();
  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
    mongoClient.close();
  }
})

app.post("/messages", async (req, res) => {
  const { user } = req.headers;

  try {
    const { body } = req
    const reqBody =
    {
      to: body.to,
      from: user,
      text: body.text,
      type: body.type,
      time: dayjs().format("HH:mm:ss")
    }

    await mongoClient.connect();
    db = mongoClient.db("projeto_12_UOL");
    await db.collection("messages").insertOne(reqBody);
    res.sendStatus(201);
    mongoClient.close();

  } catch (e) {
    console.log(chalk.red.bold(e));
    res.status(500).send(e);
    mongoClient.close();
  }
})

app.listen(process.env.PORT, () => console.log(chalk.blue.bold("Server ON")));

