import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";
import chalk from "chalk";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then(() => {
  db = mongoClient.db("projeto_12_UOL");
  console.log(chalk.magenta.bold("DB ON"));
});
promise.catch((e) => {
  console.log(chalk.red.bold("DB OFF", e))
})

//Participants Route
app.get("/participants", async (req, res) => {
  try {
    const participantsList = await db.collection("participants").find({}).toArray();
    res.status(200).send(participantsList);
  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
  }
})

app.post("/participants", async (req, res) => {
  try {
    const participantName = req.body;

    const participantsSchema = joi.object({
      name: joi.string().required(),
    })

    const participantsValidation = participantsSchema.validate(participantName, { abortEarly: false });

    if (participantsValidation.error) {
      console.log(participantsValidation);
      res.sendStatus(422);
      return;
    }

    await db.collection("participants").insertOne({
      name: participantName.name,
      lastStatus: Date.now()
    });
    await db.collection("messages").insertOne({
      from: participantName.name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format("HH:mm:ss")
    });
    res.sendStatus(201);
  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
  }
});

//Messages Route
app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const { limit } = req.query;
  try {
    if (limit) {
      const messagesList = await db
        .collection("messages")
        .find({ $or: [{ to: user }, { to: "Todos" }, { type: "message" }, { from: user }] })
        .toArray();

      const messagesListSplice = [...messagesList].splice(0, parseInt(limit))
      res.status(200).send(messagesListSplice);
      return;
    }

    const messagesList = await db
      .collection("messages")
      .find({ $or: [{ to: user }, { to: "Todos" }, { type: "message" }, { from: user }] })
      .toArray();

    res.status(200).send(messagesList);

  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
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
    await db.collection("messages").insertOne(reqBody);
    res.sendStatus(201);

  } catch (e) {
    console.log(chalk.red.bold(e));
    res.status(500).send(e);
  }
})

//Status Route
app.post("/status", async (req, res) => {
  const { user } = req.headers;
  try {
    const participantsCollection = db.collection("participants");
    const participantsList = await participantsCollection.findOne({ name: user });

    if (!participantsList) {
      res.sendStatus(404);
      return;
    }

    await participantsCollection.updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
    res.sendStatus(200);

  } catch (e) {
    console.log(chalk.red.bold(e));
    res.status(500).send(e);
  }
})

//Remove Participants
setInterval(async () => {
  try {
    const participantsCollection = db.collection("participants");
    const participantsList = await participantsCollection
      .find({})
      .toArray();

    for (let i = 0; i < participantsList.length; i++) {
      if (participantsList[i].lastStatus < (Date.now() - 10000)) {

        const reqBody =
        {
          to: "Todos",
          from: participantsList[i].name,
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss")
        }
        await db.collection("messages").insertOne(reqBody);

        await participantsCollection.deleteOne({ _id: new ObjectId(participantsList[i]._id) });
      }
    }

  } catch (e) {
    console.log(chalk.red.bold(e));
  }

}, 15000);

app.listen(process.env.PORT, () => console.log(chalk.blue.bold("Server ON")));

